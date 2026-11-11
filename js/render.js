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
    gl.uniform1i(texturingULoc,showTexture); // texturing on/off, from the page checkbox
    gl.uniform1i(lightingULoc,useLighting); // lighting on/off, from the page checkbox

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

    // two passes: opaque models first (depth test and write), then transparent models
    // (depth test only, blended), so transparent models never hide what is behind them
    for (var pass=0; pass<2; pass++) {
        var opaquePass = (pass == 0);

        if (opaquePass) {
            gl.disable(gl.BLEND);
            gl.depthMask(true); // opaque: test and write depth
        } else {
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA, // color: standard alpha blend
                                 gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // alpha: accumulate coverage for the page compositor
            gl.depthMask(false); // transparent: test depth, but don't write it
        } // end if opaque pass

        // render each triangle set (none if hidden)
        var currSet; // the tri set and its material properties
        for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
            currSet = inputTriangles[whichTriSet];
            if (currSet.lightMapDemo ? !showLightMapTriangle : (currSet.extra ? !showExtraTriangles : !showTriangles))
                continue; // hidden by its page checkbox
            if (isOpaque(currSet.material.alpha,textures[whichTriSet]) != opaquePass)
                continue; // belongs to the other pass
            gl.uniform1f(alphaULoc,useMaterialAlpha ? currSet.material.alpha : 1.0); // pass in the material alpha
        
            // make model transform, add to view project
            makeModelTransform(currSet);
            mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
        
            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
        
            // vertex buffer: activate and feed into vertex shader
            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
            gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
            gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed

            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[whichTriSet]);
            gl.vertexAttribPointer(vUVAttribLoc, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
            bindLightMap(lightMaps[whichTriSet]);
            gl.uniform1i(textureULoc, 0); // sampler reads texture unit 0

            // triangle buffer: activate and render
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
            gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
        
        } // end for each triangle set
    
        // render each ellipsoid (none if hidden)
        var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material
        var ellipsoidsToDraw = showEllipsoids ? numEllipsoids : 0;
        for (var whichEllipsoid=0; whichEllipsoid<ellipsoidsToDraw; whichEllipsoid++) {
            ellipsoid = inputEllipsoids[whichEllipsoid];
            if (isOpaque(ellipsoid.alpha,textures[numTriangleSets+whichEllipsoid]) != opaquePass)
                continue; // belongs to the other pass
            gl.uniform1f(alphaULoc,useMaterialAlpha ? ellipsoid.alpha : 1.0); // pass in the material alpha
        
            // define model transform, premult with pvmMatrix, feed to vertex shader
            makeModelTransform(ellipsoid);
            pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
            gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
            gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

            // reflectivity: feed to the fragment shader
            gl.uniform3fv(ambientULoc,ellipsoid.ambient); // pass in the ambient reflectivity
            gl.uniform3fv(diffuseULoc,ellipsoid.diffuse); // pass in the diffuse reflectivity
            gl.uniform3fv(specularULoc,ellipsoid.specular); // pass in the specular reflectivity
            gl.uniform1f(shininessULoc,ellipsoid.n); // pass in the specular exponent

            gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[numTriangleSets+whichEllipsoid]); // activate vertex buffer
            gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
            gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[numTriangleSets+whichEllipsoid]); // activate normal buffer
            gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
            gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[numTriangleSets+whichEllipsoid]); // activate uv buffer
            gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed uv buffer to shader

            // texture: bind to unit 0, where the sampler reads
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D,textures[numTriangleSets+whichEllipsoid]);
            bindLightMap(lightMaps[numTriangleSets+whichEllipsoid]);
            gl.uniform1i(textureULoc,0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[numTriangleSets+whichEllipsoid]); // activate tri buffer
        
            // draw a transformed instance of the ellipsoid
            gl.drawElements(gl.TRIANGLES,triSetSizes[numTriangleSets+whichEllipsoid],gl.UNSIGNED_SHORT,0); // render
        } // end for each ellipsoid
    } // end for each pass

    gl.depthMask(true); // restore, or next frame's gl.clear won't clear the depth buffer
} // end render model
