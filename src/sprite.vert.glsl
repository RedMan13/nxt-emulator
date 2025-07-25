#version 300 es
in vec4 position;
uniform vec2 bottomLeft;
uniform vec2 topRight;
uniform vec2 scale;
uniform vec2 pos;
uniform vec2 size;
out vec2 texturePos;

void main() {
    gl_Position = vec4(((position.xy * scale) + pos) / (size / 2.0), 1,1);
    texturePos = (position.xy - bottomLeft) / (topRight - bottomLeft);
}