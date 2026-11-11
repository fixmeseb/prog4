//true if n is a power of two.
function isPowerOf2(n){
    return (n & (n-1))===0;
}

// true if any pixel of the loaded image is less than fully opaque.
function imageHasAlpha(image) {
    try {
        var canvas = document.createElement("canvas"); // offscreen 2d canvas to read the pixels back
        canvas.width = image.width;
        canvas.height = image.height;
        var context = canvas.getContext("2d");
        context.drawImage(image,0,0);
        var pixels = context.getImageData(0,0,image.width,image.height).data; // rgba bytes
        for (var whichAlpha=3; whichAlpha<pixels.length; whichAlpha+=4)
            if (pixels[whichAlpha] < 255)
                return true;
        return false;
    } // end try

    catch(e) { // can't read the pixels: assume transparency, since a blended draw is the safe one
        console.log(e);
        return true;
    } // end catch
} // end image has alpha

// get a texture object for the named image, loading it if needed.
// returns immediately with a 1x1 white placeholder; the real image replaces it when it arrives.
function loadTexture(textureName) {

    if (textureCache[textureName] !== undefined)
        return textureCache[textureName]; // already loading or loaded

    // placeholder: one opaque white texel, so the set renders right away (white leaves lit color unchanged)
    var texture = gl.createTexture();
    texture.hasAlpha = false; // the placeholder is opaque; updated when the real image loads
    gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); // default filter wants mipmaps: black without this

    // real image: fetch it, then upload when loaded
    var image = new Image();
    image.crossOrigin = "Anonymous"; // CORS request, or webgl refuses the upload
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true); // image rows are top-down, uv (0,0) is bottom left
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        texture.hasAlpha = imageHasAlpha(image); // models using it must draw in the transparent pass

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) { // full webgl1 support: mipmaps and repeat
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
        } else { // non power of two: webgl1 requires clamping and no mipmaps
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        } // end if non power of two
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    }; // end on image load
    image.onerror = function() {
        console.log("Unable to load texture "+textureName+", keeping placeholder");
    }; // end on image error
    image.src = TEXTURES_URL + textureName; // starts the download

    textureCache[textureName] = texture;
    return texture;
} // end load texture

// read models in, load them into webgl buffers
function loadModels() {
    
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var UVToAdd;
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            // process each triangle set to load webgl vertex and triangle buffers
            inputTriangles = inputTriangles.concat(EXTRA_TRIANGLES); // add the local extra sets, see config.js
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].glUVs = []; //flat UV list for webgl
                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    UVToAdd = inputTriangles[whichSet].uvs[whichSetVert]; 

                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].glUVs.push(UVToAdd[0], UVToAdd[1])
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in
                uvBuffers[whichSet] = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichSet]);
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glUVs), gl.STATIC_DRAW)

                // get this set's texture (placeholder until its image loads)
                var textureName = inputTriangles[whichSet].material.texture;
                textures[whichSet] = (typeof(textureName) === "string") ? loadTexture(textureName) : null;
                var lightMapName = inputTriangles[whichSet].material.lightMap; // optional second texture
                lightMaps[whichSet] = (typeof(lightMapName) === "string") ? loadTexture(lightMapName) : null;

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
        
            inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL,"ellipsoids"); // read in the ellipsoids

            if (inputEllipsoids == String.null)
                throw "Unable to load ellipsoids file!";
            else {
                
                // init ellipsoid highlighting, translation and rotation; update bbox
                var ellipsoid; // current ellipsoid
                var ellipsoidModel; // current ellipsoid triangular model
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from ellipsoid
                numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
                for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                    
                    // set up various stats and transforms for this ellipsoid
                    ellipsoid = inputEllipsoids[whichEllipsoid];
                    ellipsoid.on = false; // ellipsoids begin without highlight
                    ellipsoid.translation = vec3.fromValues(0,0,0); // ellipsoids begin without translation
                    ellipsoid.xAxis = vec3.fromValues(1,0,0); // ellipsoid X axis
                    ellipsoid.yAxis = vec3.fromValues(0,1,0); // ellipsoid Y axis 
                    ellipsoid.center = vec3.fromValues(ellipsoid.x,ellipsoid.y,ellipsoid.z); // locate ellipsoid ctr
                    vec3.set(minXYZ,ellipsoid.x-ellipsoid.a,ellipsoid.y-ellipsoid.b,ellipsoid.z-ellipsoid.c); 
                    vec3.set(maxXYZ,ellipsoid.x+ellipsoid.a,ellipsoid.y+ellipsoid.b,ellipsoid.z+ellipsoid.c); 
                    vec3.min(minCorner,minCorner,minXYZ); // update world bbox min corner
                    vec3.max(maxCorner,maxCorner,maxXYZ); // update world bbox max corner

                    // make the ellipsoid model
                    ellipsoidModel = makeEllipsoid(ellipsoid,32);
                    ellipsoid.glVertices = ellipsoidModel.vertices; // keep the flat coord and index lists,
                    ellipsoid.glTriangles = ellipsoidModel.triangles; // as tri sets do, for depth sorting
    
                    // send the ellipsoid vertex coords and normals to webGL
                    vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.vertices),gl.STATIC_DRAW); // data in
                    normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.normals),gl.STATIC_DRAW); // data in
        
                    uvBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid uv buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[uvBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.uvs),gl.STATIC_DRAW); // data in

                    // get this ellipsoid's texture (placeholder until its image loads)
                    textures.push((typeof(ellipsoid.texture) === "string") ? loadTexture(ellipsoid.texture) : null);
                    lightMaps.push((typeof(ellipsoid.lightMap) === "string") ? loadTexture(ellipsoid.lightMap) : null);

                    triSetSizes.push(ellipsoidModel.triangles.length);
    
                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ellipsoidModel.triangles),gl.STATIC_DRAW); // data in
                } // end for each ellipsoid
                
                viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global
            } // end if ellipsoid file loaded
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models
