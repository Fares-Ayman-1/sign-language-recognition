"""Sign classifier: depthwise Conv1D blocks for local motion, Transformer blocks for the whole sign.

Attention is written with plain matrix products (no fused kernels) so the model exports cleanly to
ONNX and runs in ONNX Runtime Web. ``mask`` marks real frames in a padded training batch; at serving
time there is one unpadded sequence and no mask, which gives the same result.
"""

from __future__ import annotations

import math

import torch
import torch.nn.functional as F
from torch import nn

from islr.features import FEATURE_DIM, Preprocess


class ConvBlock(nn.Module):
    def __init__(self, dim: int, kernel: int, expand: int, drop: float) -> None:
        super().__init__()
        hidden = dim * expand
        self.norm = nn.LayerNorm(dim)
        self.inp = nn.Linear(dim, hidden * 2)  # GLU
        self.dw = nn.Conv1d(hidden, hidden, kernel, padding=kernel // 2, groups=hidden)
        self.norm2 = nn.LayerNorm(hidden)
        self.out = nn.Linear(hidden, dim)
        self.drop = nn.Dropout(drop)

    def forward(self, x: torch.Tensor, mask: torch.Tensor | None) -> torch.Tensor:
        h = F.glu(self.inp(self.norm(x)), dim=-1)
        if mask is not None:  # padded frames must not leak into the convolution
            h = h * mask.unsqueeze(-1)
        h = self.dw(h.transpose(1, 2)).transpose(1, 2)
        h = self.out(F.silu(self.norm2(h)))
        return x + self.drop(h)


class TransformerBlock(nn.Module):
    def __init__(self, dim: int, heads: int, expand: int, drop: float) -> None:
        super().__init__()
        self.heads = heads
        self.norm1 = nn.LayerNorm(dim)
        self.qkv = nn.Linear(dim, dim * 3)
        self.proj = nn.Linear(dim, dim)
        self.norm2 = nn.LayerNorm(dim)
        self.ffn = nn.Sequential(nn.Linear(dim, dim * expand), nn.GELU(), nn.Linear(dim * expand, dim))
        self.drop = nn.Dropout(drop)

    def attention(self, x: torch.Tensor, mask: torch.Tensor | None) -> torch.Tensor:
        b, t, d = x.shape
        q, k, v = self.qkv(x).reshape(b, t, 3, self.heads, d // self.heads).permute(2, 0, 3, 1, 4)
        scores = q @ k.transpose(-2, -1) / math.sqrt(d // self.heads)
        if mask is not None:
            scores = scores.masked_fill(~mask[:, None, None, :], torch.finfo(scores.dtype).min)
        out = scores.softmax(dim=-1) @ v
        return self.proj(out.transpose(1, 2).reshape(b, t, d))

    def forward(self, x: torch.Tensor, mask: torch.Tensor | None) -> torch.Tensor:
        x = x + self.drop(self.attention(self.norm1(x), mask))
        return x + self.drop(self.ffn(self.norm2(x)))


class SignModel(nn.Module):
    def __init__(
        self,
        n_classes: int = 250,
        dim: int = 192,
        stages: int = 2,
        convs_per_stage: int = 3,
        kernel: int = 17,
        heads: int = 4,
        expand: int = 2,
        drop: float = 0.2,
        head_drop: float = 0.4,
    ) -> None:
        super().__init__()
        self.stem = nn.Sequential(nn.Linear(FEATURE_DIM, dim), nn.LayerNorm(dim))
        blocks: list[nn.Module] = []
        for _ in range(stages):
            blocks += [ConvBlock(dim, kernel, expand, drop) for _ in range(convs_per_stage)]
            blocks.append(TransformerBlock(dim, heads, expand, drop))
        self.blocks = nn.ModuleList(blocks)
        self.norm = nn.LayerNorm(dim)
        self.head = nn.Sequential(nn.Dropout(head_drop), nn.Linear(dim, n_classes))

    def forward(self, x: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        """Features [B, T, FEATURE_DIM] (+ optional mask [B, T], True = real frame) -> logits [B, classes]."""
        h = self.stem(x)
        for blk in self.blocks:
            h = blk(h, mask)
        h = self.norm(h)
        if mask is None:
            pooled = h.mean(dim=1)
        else:
            m = mask.unsqueeze(-1).to(h.dtype)
            pooled = (h * m).sum(dim=1) / m.sum(dim=1).clamp(min=1.0)
        return self.head(pooled)


class EndToEnd(nn.Module):
    """What is exported: raw landmarks [T, 543, 3] -> class probabilities [250]."""

    def __init__(self, model: SignModel, max_len: int) -> None:
        super().__init__()
        self.pre = Preprocess(max_len)
        self.model = model

    def forward(self, raw: torch.Tensor) -> torch.Tensor:
        return self.model(self.pre(raw).unsqueeze(0)).softmax(dim=-1)[0]
