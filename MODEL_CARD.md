# Model card: Conv1D + Transformer for isolated sign recognition

> **A research demo, not an interpreter.** It recognises single, isolated signs from a fixed list of
> 250. It does not understand sentences, grammar, fingerspelling or facial expressions as language, and
> must not be used where a wrong answer matters (medical, legal, emergency or education assessment).
> Deaf and hard-of-hearing people should be involved in any product built on work like this.

## What it does
Input: the MediaPipe Holistic landmarks of one sign, `[frames, 543, 3]` (face, both hands, body; NaN
where a part was not detected). Output: a probability for each of 250 American Sign Language signs.

Everything after MediaPipe is inside one ONNX graph:
1. keep 89 points (nose, 40 lip points, both hands, shoulders to wrists), x and y only;
2. mirror the sequence if the left hand is seen more often than the right, so the dominant hand is
   always in the same slot (left-handed signers and mirrored cameras look the same to the model);
3. normalise by the sequence's own centre and spread; add velocities and the dominant hand's shape
   relative to its wrist;
4. keep at most 64 evenly spaced frames;
5. six depthwise Conv1D blocks and two Transformer blocks (width 192, 2.1 million parameters), mean
   pooling over time and a linear classifier.

The ONNX file is about 8.5 MB and runs on a CPU (ONNX Runtime) or in a browser (ONNX Runtime Web).

## Training data
The Google Isolated Sign Language Recognition competition data on Kaggle, licensed **CC BY 4.0**:
94,477 short videos (as landmarks, not images) of 250 signs from 21 signers, about 380 videos per sign.
The landmark files are not redistributed here; download them with your own Kaggle account.

## Evaluation
- **Signer-independent split.** Signers 4718, 26734, 37779 and 61333 (18,022 videos, 19%) are never used
  for training. Each signer recorded every sign many times, so a random split would put the same person
  in training and validation and overstate accuracy.
- **Metric:** top-1 accuracy over the 250 signs (the competition metric), plus top-5.
- **Baselines:** the most frequent sign, and a "bag of frames" MLP that sees the same features averaged
  over time. The gap to the main model is what modelling the order of movements is worth.
- **Final-epoch weights** are reported; no checkpoint was picked on the validation signers.
- **Shipped-artifact check:** the exported ONNX model is also scored on a downloaded sample of the
  held-out signers' raw files, through the API's own parquet reader (`python -m islr.evaluate`).

Results are in [RESULTS.md](RESULTS.md), generated from MLflow.

## Known limitations
- **21 signers.** Signers vary in speed, size, handedness and style far more than 21 people can show.
  Accuracy on a new person, especially a native signer with fluent, fast signing, may be lower.
- **One camera setup.** The data was recorded on phones held in front of the signer. Webcams at other
  angles, distances, frame rates or lighting change the landmarks (the drift checks below watch for this).
- **Isolated signs only.** The demo segments a sign by waiting for the hands to drop; it cannot split
  continuous signing.
- **Similar signs get confused.** Signs that differ only in a small hand-shape detail or in facial
  expression are the most frequent errors (see the confusion table in RESULTS.md). Showing the top five
  guesses is more useful than trusting the first.
- **Landmarks, not video.** If MediaPipe misses a hand (motion blur, occlusion, gloves), the model sees
  nothing for those frames.
- **Not checked for bias across skin tone, age or disability.** The data has no such labels; MediaPipe's
  detection quality can vary across them.

## Monitoring
`python -m islr.monitoring` compares new sequences with the training reference on three checks:
- **sequence length:** an alert when the population stability index of the length distribution exceeds
  0.2 (a different frame rate or signing speed);
- **missing landmarks:** an alert when the share of frames without the dominant hand, the lips or the
  pose changes by more than 0.15 (framing, lighting or occlusion);
- **confidence:** an alert when the mean top-1 probability drops by more than 0.10 compared with the
  held-out signers.

**Input checks warn; a confidence drop recommends retraining.** The first version recommended a
retrain on any failed check. On the 300 downloaded videos of the four unseen signers, the length PSI
came out at 0.20 (sampling alone explains about 0.03), so these signers really do sign at a different
pace from the training signers. Yet their mean confidence was 0.02 *higher* and top-1 accuracy was
0.80. A rule that asks for a retrain there would fire on every new signer, so it was changed (after
seeing this result) to: input drift means "check a labelled sample from the new setting"; a confidence
drop of more than 0.10 means "collect labelled examples and retrain". The report prints the PSI noise
floor for the batch size, (bins − 1)(1/n + 1/n_ref), so small batches are not over-read.

A note on how this was found: the first local sample was missing 41 of its 300 files, and those were
the longest sequences (the biggest files, which timed out). The partial sample showed a fake length
PSI of 0.90. `scripts/download_data.py` now retries and stops if any file is still missing.
