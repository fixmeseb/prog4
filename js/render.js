// render the loaded model
function renderModels() {

    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center));

        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.2,1.2,1.2)),mMatrix); // S(1.2) * T(-ctr)

        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)

        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)

    } // end make model transform

    // bind the model's light map (if it has one and light mapping is on) to texture unit 1
    function bindLightMap(lightMap) {
        var lightMapOn = useLightMapping && lightMap != null;
        gl.uniform1i(lightMappingULoc,lightMapOn); // tell the shader whether to sample it
        if (lightMapOn) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D,lightMap);
            gl.uniform1i(lightMapULoc,1); // light map sampler reads texture unit 1
            gl.activeTexture(gl.TEXTURE0); // leave unit 0 active for everything else
        } // end if light map on
    } // end bind light map

    // a model is opaque if neither its material nor its (shown) texture has any transparency
    function isOpaque(materialAlpha,texture) {
        return (!useMaterialAlpha || materialAlpha >= 1.0) &&
               !(showTexture && useTextureAlpha && texture != null && texture.hasAlpha);
    } // end is opaque

    // describe model number whichModel for this frame. Triangle sets come first, then ellipsoids:
    // the same numbering as vertexBuffers, textures, etc.
    function describeModel(whichModel) {
        var info = {};
        if (whichModel < numTriangleSets) { // a triangle set
            var triSet = inputTriangles[whichModel];
            info.model = triSet;
            info.material = triSet.material; // tri sets keep reflectivity in a material
            info.numIndices = 3*triSetSizes[whichModel]; // tri set sizes are in triangles
            if (triSet.painterTest) // each group of sets has its own page checkbox
                info.visible = showPainterTriangles;
            else if (triSet.lightMapDemo)
                info.visible = showLightMapTriangle;
            else if (triSet.extra)
                info.visible = showExtraTriangles;
            else
                info.visible = showTriangles;
        } else { // an ellipsoid
            var ellipsoid = inputEllipsoids[whichModel-numTriangleSets];
            info.model = ellipsoid;
            info.material = ellipsoid; // ellipsoids keep reflectivity in the ellipsoid itself
            info.numIndices = triSetSizes[whichModel]; // ellipsoid sizes are in indices
            info.visible = showEllipsoids;
        } // end if ellipsoid
        info.opaque = isOpaque(info.material.alpha,textures[whichModel]);
        if (info.visible) { // this frame's model transform
            makeModelTransform(info.model);
            info.mMatrix = mat4.clone(mMatrix);
        } // end if visible
        return info;
    } // end describe model

    // send everything the shaders need to draw model number whichModel: transforms, material,
    // vertex/normal/uv/triangle buffers, texture and light map
    function bindModel(whichModel,info) {

        // model transform, add to view project
        mat4.multiply(pvmMatrix,pvMatrix,info.mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, info.mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

        // reflectivity and alpha: feed to the fragment shader
        gl.uniform3fv(ambientULoc,info.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,info.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,info.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,info.material.n); // pass in the specular exponent
        gl.uniform1f(alphaULoc,useMaterialAlpha ? info.material.alpha : 1.0); // pass in the material alpha

        // vertex buffers: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichModel]); // activate
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichModel]); // activate
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichModel]); // activate
        gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed

        // texture: bind to unit 0, where the sampler reads. Models without one are drawn untextured
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,textures[whichModel]);
        gl.uniform1i(textureULoc,0); // sampler reads texture unit 0
        gl.uniform1i(texturingULoc,showTexture && textures[whichModel] != null); // texturing on/off
        bindLightMap(lightMaps[whichModel]);

        // triangle buffer: activate
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichModel]);
    } // end bind model

    // the centroid of each of the model's triangles, in model space, as a flat xyz list.
    // computed once per model, then remembered
    function getTriCentroids(model) {
        if (model.triCentroids === undefined) {
            var verts = model.glVertices, tris = model.glTriangles; // flat coord and index lists
            var centroids = new Float32Array(tris.length); // 3 indices per tri in, 3 coords per tri out
            for (var whichIdx=0; whichIdx<tris.length; whichIdx+=3)
                for (var axis=0; axis<3; axis++)
                    centroids[whichIdx+axis] = (verts[3*tris[whichIdx]+axis] + verts[3*tris[whichIdx+1]+axis] +
                                                verts[3*tris[whichIdx+2]+axis]) / 3;
            model.triCentroids = centroids;
        } // end if not yet computed
        return model.triCentroids;
    } // end get tri centroids

    // painter's algorithm: draw every triangle of every visible transparent model, farthest first.
    // Each triangle gets its own draw call, so the gpu must finish blending one before the next.
    function drawTransparentSorted(models) {
        var depths = []; // view space z of each transparent triangle's centroid
        var modelOf = []; // which model each transparent triangle belongs to
        var triOf = []; // which triangle it is within that model
        var order = []; // indices into the three lists above, to be sorted by depth
        var mvMatrix = mat4.create(); // view * model
        var centroids; // the current model's triangle centroids

        // gather the transparent triangles and their depths
        for (var whichModel=0; whichModel<models.length; whichModel++) {
            if (!models[whichModel].visible || models[whichModel].opaque)
                continue; // hidden, or drawn in the opaque pass
            mat4.multiply(mvMatrix,vMatrix,models[whichModel].mMatrix);
            centroids = getTriCentroids(models[whichModel].model);
            for (var whichCoord=0; whichCoord<centroids.length; whichCoord+=3) {
                depths.push(mvMatrix[2]*centroids[whichCoord] + mvMatrix[6]*centroids[whichCoord+1] +
                            mvMatrix[10]*centroids[whichCoord+2] + mvMatrix[14]); // z row of view * model * centroid
                modelOf.push(whichModel);
                triOf.push(whichCoord/3);
                order.push(order.length);
            } // end for each triangle
        } // end for each model

        // the view looks down -z, so the most negative z is the farthest: sort ascending
        order.sort(function(a,b) { return depths[a] - depths[b]; });

        // draw back to front, only re-sending model state when the model changes
        var boundModel = -1; // the model whose state is currently in the shaders
        for (var whichOrder=0; whichOrder<order.length; whichOrder++) {
            var whichTri = order[whichOrder];
            if (modelOf[whichTri] != boundModel) {
                boundModel = modelOf[whichTri];
                bindModel(boundModel,models[boundModel]);
            } // end if model changed
            gl.drawElements(gl.TRIANGLES,3,gl.UNSIGNED_SHORT,triOf[whichTri]*3*2); // one tri: 3 indices of 2 bytes
        } // end for each sorted triangle
    } // end draw transparent sorted

    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices

    window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view

    gl.uniform1i(blendModeULoc,blendMode); // light/texture blend mode, from the page drop down
    gl.uniform1i(textureAlphaULoc,useTextureAlpha); // texture alpha on/off, from the page checkbox
    gl.uniform1i(lightingULoc,useLighting); // lighting on/off, from the page checkbox

    // describe every model for this frame: triangle sets, then ellipsoids
    var models = [];
    for (var whichModel=0; whichModel<numTriangleSets+numEllipsoids; whichModel++)
        models.push(describeModel(whichModel));

    // pass 1, opaque models: depth test and write, no blending, any order
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (var whichModel=0; whichModel<models.length; whichModel++) {
        if (!models[whichModel].visible || !models[whichModel].opaque)
            continue; // hidden, or drawn in the transparent pass
        bindModel(whichModel,models[whichModel]);
        gl.drawElements(gl.TRIANGLES,models[whichModel].numIndices,gl.UNSIGNED_SHORT,0); // render
    } // end for each opaque model

    // pass 2, transparent models: depth test only and blended, so they never hide what is behind them
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA, // color: standard alpha blend
                         gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // alpha: accumulate coverage for the page compositor
    gl.depthMask(false); // test depth, but don't write it
    if (usePainters)
        drawTransparentSorted(models); // triangle by triangle, farthest first
    else { // model by model, in load order
        for (var whichModel=0; whichModel<models.length; whichModel++) {
            if (!models[whichModel].visible || models[whichModel].opaque)
                continue; // hidden, or drawn in the opaque pass
            bindModel(whichModel,models[whichModel]);
            gl.drawElements(gl.TRIANGLES,models[whichModel].numIndices,gl.UNSIGNED_SHORT,0); // render
        } // end for each transparent model
    } // end if not using painter's algorithm

    gl.depthMask(true); // restore, or next frame's gl.clear won't clear the depth buffer
} // end render model
