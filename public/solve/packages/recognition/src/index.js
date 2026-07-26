// @problem-runtime/recognition — M0 surface: the digits-local lane.
// The full bus (region dispatcher, multi-lane arbitration) grows here;
// observation.v1 is already the shape every future lane must emit.
export { recognizeAnswer, recognizeInk, clusterStrokes, localDigitsLane, LANE, CONFIDENCE_THRESHOLD } from './digits-lane.js';
export { recognizeCloud, prepareTemplate, resample, normalize } from './pcloud.js';
export { DIGIT_TEMPLATES, OPERATOR_TEMPLATES, TEMPLATE_VERSION } from './digit-templates.js';
export { rasterizeToMnist, softmax, SIZE, MEAN, STD } from './raster.js';
export { makeOnnxLane, browserSession, LANE as ONNX_LANE } from './onnx-digits-lane.js';
export { createBus } from './bus.js';
export { makeRemoteExpressionLane } from './remote-lane.js';
