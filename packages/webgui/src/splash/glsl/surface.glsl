#version 300 es
// camera-centred polar grid (their OceanSurface), restricted to the forward sector the fixed camera sees
precision highp float;
uniform sampler2D uD0, uD1, uD2, uS0, uS1, uS2, uS3;
uniform vec4 uLen;
uniform vec3 uCam;
