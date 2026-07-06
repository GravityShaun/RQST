const GRAINY_GRADIENT_SHADER = `
uniform float2 iResolution;
uniform float iTime;
uniform float4 uColor0;
uniform float4 uColor1;
uniform float4 uColor2;
uniform float4 uColor3;
uniform float4 uColor4;
uniform int uColorCount;
uniform float uAmplitude;
uniform float uGrainIntensity;
uniform float uGrainSize;
uniform float uGrainEnabled;
uniform float uBrightness;
uniform float4 uGrainColor;

float3 mod289(float3 x) { 
  return x - floor(x * (1.0 / 289.0)) * 289.0; 
}

float4 mod289(float4 x) { 
  return x - floor(x * (1.0 / 289.0)) * 289.0; 
}

float4 permute(float4 x) { 
  return mod289(((x * 34.0) + 1.0) * x); 
}

float4 taylorInvSqrt(float4 r) { 
  return 1.79284291400159 - 0.85373472095314 * r; 
}

float snoise(float3 v) {
  const float2 C = float2(1.0/6.0, 1.0/3.0);
  const float4 D = float4(0.0, 0.5, 1.0, 2.0);

  float3 i  = floor(v + dot(v, C.yyy));
  float3 x0 = v - i + dot(i, C.xxx);

  float3 g = step(x0.yzx, x0.xyz);
  float3 l = 1.0 - g;
  float3 i1 = min(g.xyz, l.zxy);
  float3 i2 = max(g.xyz, l.zxy);

  float3 x1 = x0 - i1 + C.xxx;
  float3 x2 = x0 - i2 + C.yyy;
  float3 x3 = x0 - D.yyy;

  i = mod289(i);
  float4 p = permute(permute(permute(
             i.z + float4(0.0, i1.z, i2.z, 1.0))
           + i.y + float4(0.0, i1.y, i2.y, 1.0))
           + i.x + float4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  float3 ns = n_ * D.wyz - D.xzx;

  float4 j = p - 49.0 * floor(p * ns.z * ns.z);

  float4 x_ = floor(j * ns.z);
  float4 y_ = floor(j - 7.0 * x_);

  float4 x = x_ * ns.x + ns.yyyy;
  float4 y = y_ * ns.x + ns.yyyy;
  float4 h = 1.0 - abs(x) - abs(y);

  float4 b0 = float4(x.xy, y.xy);
  float4 b1 = float4(x.zw, y.zw);

  float4 s0 = floor(b0) * 2.0 + 1.0;
  float4 s1 = floor(b1) * 2.0 + 1.0;
  float4 sh = -step(h, float4(0.0));

  float4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  float4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  float3 p0 = float3(a0.xy, h.x);
  float3 p1 = float3(a0.zw, h.y);
  float3 p2 = float3(a1.xy, h.z);
  float3 p3 = float3(a1.zw, h.w);

  float4 norm = taylorInvSqrt(float4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  float4 m = max(0.6 - float4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, float4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}


float4 getColor(int idx) {
  if (idx == 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  return uColor4;
}

void addColorContribution(float2 uv, float t, int idx, float colorCount, 
                          inout float4 color, inout float totalWeight) {
  float fi = float(idx);
  float baseAngle = fi * 6.28318530718 / colorCount;
  
  float2 offset = float2(
    sin(t + baseAngle) * uAmplitude + snoise(float3(t * 0.3, fi, 0.0)) * uAmplitude * 0.5,
    cos(t * 0.8 + baseAngle) * uAmplitude + snoise(float3(0.0, t * 0.3, fi)) * uAmplitude * 0.5
  );
  
  float radius = 0.35 + snoise(float3(fi, t * 0.2, 0.0)) * 0.1;
  if (colorCount >= 3.0 && idx == 1) {
    radius *= 0.82;
  }
  
  float xBias = 0.0;
  float yBias = 0.0;

  // Red-grey-blue layout: grey bridge across the top, saturated colors elsewhere.
  if (colorCount >= 3.0) {
    if (idx == 0) {
      xBias = 0.32;
      yBias = 0.28;
    } else if (idx == 1) {
      xBias = -0.18;
      yBias = -0.44;
    } else if (idx == 2) {
      xBias = 0.22;
      yBias = 0.18;
    }
  } else if (idx == 0) {
    xBias = -0.2;
    yBias = -0.2;
  }

  float2 pos = float2(0.5) + float2(cos(baseAngle) + xBias, sin(baseAngle) + yBias) * radius + offset;
  
  float dist = length(uv - pos);
  float weight = exp(-dist * dist * 6.0);
  
  if (colorCount >= 3.0 && idx == 1) {
    weight *= 0.68;

    float topBoost = 1.0 - smoothstep(0.0, 0.42, uv.y);
    float topLeftBoost = topBoost * (1.0 - smoothstep(0.0, 0.62, uv.x));
    weight *= 1.0 + topBoost * 1.35 + topLeftBoost * 0.75;

    float bottomLeftFade = (1.0 - smoothstep(0.0, 0.62, uv.x)) * smoothstep(0.22, 0.88, uv.y);
    weight *= 1.0 - bottomLeftFade * 0.92;
  } else if (colorCount >= 3.0 && (idx == 0 || idx == 2)) {
    float bottomLeftColorBoost = (1.0 - smoothstep(0.0, 0.58, uv.x)) * smoothstep(0.2, 0.92, uv.y);
    weight *= 1.0 + bottomLeftColorBoost * 0.55;
  } else if (colorCount < 3.0 && idx == 0) {
    float topBoost = 1.0 - smoothstep(0.0, 0.45, uv.y);
    float topLeftBoost = topBoost * (1.0 - smoothstep(0.0, 0.55, uv.x));
    weight *= 1.0 + topBoost * 1.2 + topLeftBoost * 0.6;
  }
  
  weight *= 1.0 + snoise(float3(uv * 3.0, t * 0.5 + fi)) * 0.2;
  
  color += getColor(idx) * weight;
  totalWeight += weight;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / iResolution;
  float t = iTime;
  
  float4 color = float4(0.0);
  float totalWeight = 0.0;
  float colorCount = float(uColorCount);
  
  if (uColorCount >= 1) {
    addColorContribution(uv, t, 0, colorCount, color, totalWeight);
  }
  if (uColorCount >= 2) {
    addColorContribution(uv, t, 1, colorCount, color, totalWeight);
  }
  if (uColorCount >= 3) {
    addColorContribution(uv, t, 2, colorCount, color, totalWeight);
  }
  if (uColorCount >= 4) {
    addColorContribution(uv, t, 3, colorCount, color, totalWeight);
  }
  if (uColorCount >= 5) {
    addColorContribution(uv, t, 4, colorCount, color, totalWeight);
  }
  
  color /= max(totalWeight, 0.001);
  
  color.rgb += uBrightness;
  
  if (uGrainEnabled > 0.5) {
    float grainScale = iResolution.x / uGrainSize;
    float grain1 = snoise(float3(uv * grainScale, 0.0)) * 0.6;
    float grain2 = snoise(float3(uv * grainScale * 2.0, 1.0)) * 0.3;
    float grain3 = snoise(float3(uv * grainScale * 4.0, 2.0)) * 0.1;
    float grain = (grain1 + grain2 + grain3) * uGrainIntensity;
    
    // Smooth the grain to make it rounder
    grain = smoothstep(-0.5, 0.5, grain);
    grain = (grain - 0.5) * 2.0;

    float3 grainTint = uGrainColor.rgb;
    float grainStrength = abs(grain) * uGrainIntensity * 14.0;
    color.rgb = mix(color.rgb, grainTint, clamp(grainStrength, 0.0, 0.38));
  }
  
  color.rgb = clamp(color.rgb, 0.0, 1.0);
  color.a = 1.0;
  
  return half4(color);
}
`;

export { GRAINY_GRADIENT_SHADER };
