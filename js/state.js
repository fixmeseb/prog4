/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var uvBuffers = [];
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press
var textures = [];
var lightMaps = []; // light map texture per model (null if none), same indexing as textures
var textureCache = {}; //texture objects by file name, so you only have to load shared images once.

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var alphaULoc; // where to put material alpha for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var vNormAttribLoc; // where to put normal for vertex shader
var lightingULoc; // where to put lighting on/off flag for fragment shader
var vUVAttribLoc; 
var blendModeULoc; // where to put light/texture blend mode for fragment shader
var lightMappingULoc; // where to put light mapping on/off flag for fragment shader
var lightMapULoc; // where to put the light map sampler's texture unit for fragment shader
var textureAlphaULoc; // where to put texture alpha on/off flag for fragment shader
var texturingULoc; // where to put texturing on/off flag for fragment shader
var textureULoc; 

/* display toggles, driven by the checkboxes in index.html */
var showTriangles = true; // draw the triangle sets
var showEllipsoids = true; // draw the ellipsoids
var showExtraTriangles = true; // draw the extra triangle sets from config.js
var useLighting = true; // Blinn-Phong lighting on, or flat unlit diffuse color
var showLightMapTriangle = true; // draw the light mapping demo triangle from config.js
var useLightMapping = true; // models with a light map are scaled by it, or light maps are ignored
var showTexture = true;
var useMaterialAlpha = true; // material alpha makes models transparent, or every material is treated as opaque
var useTextureAlpha = true; // texture alpha makes texels transparent, or every texel is treated as opaque
var blendMode = 0; // light/texture blending, chosen in the page drop down. 0: modulate, 1: replace, 2: modulate + specular after

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

/* page variables */
var imageContext; // 2d context of the background image canvas
