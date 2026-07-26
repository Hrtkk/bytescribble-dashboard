// onnx-digits — the Option-1 recognition lane (RFC-TUT-10 lane #2 on the bus).
// A vendored MNIST CNN (models/mnist-cnn.onnx, trained by scripts/
// export_mnist_onnx.py) classifies a single digit cluster. Environment-agnostic:
// the caller supplies { ort, session } (onnxruntime-web in the browser, the same
// in node tests), so this file couples to neither. determinism: strict — fixed
// weights, no randomness; same ink → same logits, every run.
//
// SCOPE: DIGITS ONLY (0–9). Operators stay digits-local's job; the bus runs this
// lane on digit clusters (the answer) where robustness on messy handwriting pays.

import { rasterizeToMnist, softmax } from './raster.js';

export const LANE = { id: 'onnx-digits', version: '0.1.0', model: 'mnist-cnn', determinism: 'strict' };

// A tiny loader that memoizes one session. createSession: () => Promise<{ort, session}>.
export function makeOnnxLane(createSession) {
  let ready = null;
  return {
    id: LANE.id,
    version: LANE.version,
    charset: 'digits',
    async ensure() {
      if (!ready) ready = createSession();
      return ready;
    },
    // one character cluster → ranked digit candidates [{label, score}]
    async recognizeCluster(clusterStrokes) {
      const { ort, session } = await this.ensure();
      const input = rasterizeToMnist(clusterStrokes);
      const tensor = new ort.Tensor('float32', input, [1, 1, 28, 28]);
      const out = await session.run({ [session.inputNames[0]]: tensor });
      const logits = Array.from(out[session.outputNames[0]].data);
      const probs = softmax(logits);
      return probs
        .map((score, label) => ({ label: String(label), score }))
        .sort((a, b) => b.score - a.score);
    },
  };
}

// Browser session factory (onnxruntime-web). The lane stays env-agnostic; this
// helper is what the Desk wires in. Node tests build their own with fs bytes.
export async function browserSession(modelUrl) {
  const ort = await import('onnxruntime-web');
  const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
  return { ort, session };
}
