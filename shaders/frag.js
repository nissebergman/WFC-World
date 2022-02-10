export default `
in vec2 vUv;
uniform sampler2D canvasTexture;

void main() {
  gl_FragColor = texture2D(canvasTexture, vUv);
}
`;