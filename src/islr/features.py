"""Landmark preprocessing as a PyTorch module, so it is exported inside the ONNX graph.

Training, the API and the in-browser demo all run exactly this code: the API and the browser send raw
MediaPipe landmarks [frames, 543, 3] and the model does the rest. (Project 3 taught the lesson: a
serving path that re-implements preprocessing drifts from training.)

Steps for one sequence:
1. keep the selected points (nose, lips, both hands, upper-body pose), x and y only;
2. mirror the sequence if the left hand is visible in more frames than the right, so the dominant
   hand is always in the right-hand slot (signer handedness and camera mirroring stop mattering);
3. normalise positions by the sequence's mean and standard deviation;
4. add frame-to-frame velocities and the dominant hand's shape relative to its wrist;
5. if the sequence is longer than ``max_len`` frames, keep ``max_len`` evenly spaced frames.
"""

from __future__ import annotations

import torch
from torch import nn

from islr.landmarks import LEFT_S, MIRROR, RIGHT_S, SELECTED, P

__all__ = ["FEATURE_DIM", "Preprocess"]

FEATURE_DIM = P * 2 * 2 + 21 * 2  # positions + velocities for every point, plus the hand shape


def _present_frames(part: torch.Tensor) -> torch.Tensor:
    """Number of frames in which any point of a part [T, k, 2] is present."""
    return (~torch.isnan(part[..., 0])).any(dim=1).sum()


class Preprocess(nn.Module):
    selected: torch.Tensor
    mirror: torch.Tensor

    def __init__(self, max_len: int = 64) -> None:
        super().__init__()
        self.max_len = max_len
        self.register_buffer("selected", torch.tensor(SELECTED, dtype=torch.long), persistent=False)
        self.register_buffer("mirror", torch.tensor(MIRROR, dtype=torch.long), persistent=False)

    def forward(self, raw: torch.Tensor) -> torch.Tensor:
        """Raw landmarks [T, 543, 3] (NaN = missing) -> features [min(T, max_len), FEATURE_DIM]."""
        return self.featurize(raw.index_select(1, self.selected)[..., :2])

    def featurize(self, x: torch.Tensor) -> torch.Tensor:
        """Selected points [T, P, 2] -> features. Training augments the points before this step."""
        x = x.float()
        # 2. handedness: mirror x -> 1 - x and swap left/right point slots
        flip = _present_frames(x[:, LEFT_S]) > _present_frames(x[:, RIGHT_S])
        xm = x.index_select(1, self.mirror)
        xm = torch.stack([1.0 - xm[..., 0], xm[..., 1]], dim=-1)
        x = torch.where(flip, xm, x)

        # 3. normalise by the sequence's own centre and spread (missing points -> 0 afterwards)
        valid = ~torch.isnan(x[..., 0])  # [T, P]
        v = valid.unsqueeze(-1).float()
        x0 = torch.where(torch.isnan(x), torch.zeros_like(x), x)
        count = v.sum().clamp(min=1.0)
        mean = (x0 * v).sum(dim=(0, 1)) / count  # [2]
        var = (((x0 - mean) ** 2) * v).sum() / (count * 2.0)
        std = torch.sqrt(var).clamp(min=1e-3)
        pos = (x0 - mean) / std * v

        # 4a. velocities, zero where either frame misses the point
        both = v[1:] * v[:-1]
        vel = torch.cat([torch.zeros_like(pos[:1]), (pos[1:] - pos[:-1]) * both], dim=0)

        # 4b. dominant-hand shape: points relative to the wrist, scaled by the hand's size
        hand = x0[:, RIGHT_S]
        hv = v[:, RIGHT_S]
        rel = hand - hand[:, :1]
        size = torch.sqrt((rel**2).sum(-1)).amax(dim=1, keepdim=True).clamp(min=1e-4)
        shape = rel / size.unsqueeze(-1) * hv

        feats = torch.cat([pos.flatten(1), vel.flatten(1), shape.flatten(1)], dim=1)

        # 5. at most max_len evenly spaced frames (identity when the sequence is short enough)
        t = torch._shape_as_tensor(feats)[0]
        n = torch.clamp(t, max=self.max_len)
        steps = torch.arange(n, device=feats.device).float()  # type: ignore[call-overload]
        idx = torch.floor(steps * (t.float() / n.float())).long()
        return feats.index_select(0, idx)
