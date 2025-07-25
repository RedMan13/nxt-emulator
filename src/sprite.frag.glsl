#version 300 es
precision mediump float;

in vec2 texturePos;
uniform sampler2D src;
out vec4 color;

void main() {
    color = texture(src, texturePos);
}