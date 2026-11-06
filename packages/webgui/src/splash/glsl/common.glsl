#version 300 es
precision highp float; precision highp int;
const int N = 256;
const float PI = 3.14159265359, G = 9.81, ST = 7.4e-5;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
float omega(float k){ return sqrt(G * k + ST * k * k * k); }
