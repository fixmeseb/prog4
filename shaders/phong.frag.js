// fragment shader: per-fragment Blinn-Phong lighting
const PHONG_FRAG = /*glsl*/ `
    precision mediump float; // set float to medium precision

    // eye location
    uniform vec3 uEyePosition; // the eye's position in world
    
    // light properties
    uniform vec3 uLightAmbient; // the light's ambient color
    uniform vec3 uLightDiffuse; // the light's diffuse color
    uniform vec3 uLightSpecular; // the light's specular color
    uniform vec3 uLightPosition; // the light's position
    
    // material properties
    uniform vec3 uAmbient; // the ambient reflectivity
    uniform vec3 uDiffuse; // the diffuse reflectivity
    uniform vec3 uSpecular; // the specular reflectivity
    uniform float uAlpha; // the material alpha
    uniform float uShininess; // the specular exponent

    // render options
    uniform bool uTexturing; // true: modulate by the texture, false: material color only
    uniform int uBlendMode; // 0: modulate, 1: replace, 2: modulate with specular added after
    uniform bool uTextureAlpha; // true: the texture's alpha scales the fragment alpha, false: ignored
    uniform bool uLightMapping; // true: scale the output color by the light map texture
    uniform sampler2D uLightMap; // second texture: precomputed lighting
    uniform bool uLighting; // true: Blinn-Phong lighting, false: flat diffuse color
    
    // geometry properties
    varying vec3 vWorldPos; // world xyz of fragment
    varying vec3 vVertexNormal; // normal of fragment

    uniform sampler2D uTexture;
    varying vec2 vVertexUV;
    
    void main(void) {

        // texture color, or white (leaves the material color unchanged) when texturing is off
        vec4 texSample = uTexturing ? texture2D(uTexture, vVertexUV) : vec4(1.0);
        vec3 texColor = texSample.rgb;
        float alpha = uAlpha * (uTextureAlpha ? texSample.a : 1.0);

        // light map color, or white (leaves the output color unchanged) when light mapping is off
        vec3 lightMapColor = uLightMapping ? texture2D(uLightMap, vVertexUV).rgb : vec3(1.0); // material alpha times texture alpha

        // lighting disabled: flat, unlit material color
        if (!uLighting) {
            gl_FragColor = vec4(((uTexturing && uBlendMode == 1) ? texColor : uDiffuse*texColor)*lightMapColor, alpha);
            return;
        }

        // ambient term
        vec3 ambient = uAmbient*uLightAmbient; 
        
        // diffuse term
        vec3 normal = normalize(vVertexNormal); 
        vec3 light = normalize(uLightPosition - vWorldPos);
        float lambert = max(0.0,dot(normal,light));
        vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
        
        // specular term
        vec3 eye = normalize(uEyePosition - vWorldPos);
        vec3 halfVec = normalize(light+eye);
        float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
        vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
        
        // combine to output color
        vec3 colorOut;
        if (uTexturing && uBlendMode == 1)
            colorOut = texColor; // replace: texture only, lighting ignored
        else if (uBlendMode == 2)
            colorOut = (ambient + diffuse)*texColor + specular; // modulate, then add untinted highlights
        else
            colorOut = (ambient + diffuse + specular)*texColor; // modulate: lit color scales texture
        gl_FragColor = vec4(colorOut*lightMapColor, alpha); 

    }
`;
