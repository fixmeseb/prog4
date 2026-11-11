/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog4/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog4/ellipsoids.json"; // ellipsoids file loc
const TEXTURES_URL = "https://ncsucgclass.github.io/prog4/"
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(-0.5,1.5,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

// extra triangle sets, added to the ones loaded from INPUT_TRIANGLES_URL. Same format as that file,
// plus extra:true so the page's "Extra triangles" checkbox can show/hide them separately
// (lightMapDemo:true for the "Light map triangle" checkbox, painterTest:true for "Painter test triangles"),
// and an optional material.lightMap texture. material.texture is optional too.
// They sit in a row above the ellipsoids. Screen right is -x with the default view, so the uvs run
// against x to show each image unmirrored.
const EXTRA_TRIANGLES = [
  {
    "extra": true,
    "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.8,0.8,0.8], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 1.0, "texture": "glass.gif"},
    "vertices": [[0.95, 1.0, 0.55],[0.825, 1.3, 0.55],[0.70, 1.0, 0.55]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  },
  {
    "extra": true,
    "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.8,0.8,0.8], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 1.0, "texture": "leaf.small.png"},
    "vertices": [[0.625, 1.0, 0.55],[0.5, 1.3, 0.55],[0.375, 1.0, 0.55]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  },
  {
    "extra": true,
    "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.8,0.8,0.8], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 1.0, "texture": "lightmap.gif"},
    "vertices": [[0.30, 1.0, 0.55],[0.175, 1.3, 0.55],[0.05, 1.0, 0.55]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  },
  { // light mapping demo, above the row of three: rock base texture, lit by a light map texture
    "lightMapDemo": true,
    "material": {"ambient": [0.1,0.1,0.1], "diffuse": [0.8,0.8,0.8], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 1.0, "texture": "rocktile.jpg", "lightMap": "lightmap.gif"},
    "vertices": [[0.70, 1.33, 0.55],[0.5, 1.53, 0.55],[0.30, 1.33, 0.55]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  },
  // painter's algorithm test, below the scene: three overlapping, untextured, half transparent triangles.
  // Listed nearest first, which is the wrong order to blend them in, so sorting visibly matters.
  {
    "painterTest": true,
    "material": {"ambient": [0.3,0.0,0.0], "diffuse": [0.9,0.0,0.0], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 0.5},
    "vertices": [[0.72, -0.40, 0.50],[0.57, -0.05, 0.50],[0.42, -0.40, 0.50]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  },
  {
    "painterTest": true,
    "material": {"ambient": [0.0,0.3,0.0], "diffuse": [0.0,0.9,0.0], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 0.5},
    "vertices": [[0.65, -0.40, 0.55],[0.50, -0.05, 0.55],[0.35, -0.40, 0.55]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  },
  {
    "painterTest": true,
    "material": {"ambient": [0.0,0.0,0.3], "diffuse": [0.0,0.0,0.9], "specular": [0.3,0.3,0.3], "n": 11, "alpha": 0.5},
    "vertices": [[0.58, -0.40, 0.60],[0.43, -0.05, 0.60],[0.28, -0.40, 0.60]],
    "normals": [[0, 0, -1],[0, 0, -1],[0, 0, -1]],
    "uvs": [[0,0], [0.5,1], [1,0]],
    "triangles": [[0,1,2]]
  }
];
