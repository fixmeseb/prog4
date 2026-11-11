// make an ellipsoid, with numLongSteps longitudes.
// start with a sphere of radius 1 at origin
// Returns verts, tris and normals.
function makeEllipsoid(currEllipsoid,numLongSteps) {
    
    try {
        if (numLongSteps % 2 != 0)
            throw "in makeSphere: uneven number of longitude steps!";
        else if (numLongSteps < 4)
            throw "in makeSphere: number of longitude steps too small!";
        else { // good number longitude steps
            var numLatSteps = numLongSteps/2
            var vertices = [], normals = [], uvs = [], triangles = [];
            console.log("ellipsoid xyz: "+ currEllipsoid.x +" "+ currEllipsoid.y +" "+ currEllipsoid.z);
            
            // make vertices
            var ellipsoidVertices = [0,-1,0]; // vertices to return, init to south pole
            var ellipsoidUVs = [0.5,0]; // uvs to return, init to south pole
            var angleIncr = (Math.PI+Math.PI) / numLongSteps; // angular increment 
            var latLimitAngle = angleIncr * (Math.floor(numLongSteps/4)-1); // start/end lat angle
            var latRadius, latY, latV; // radius, Y and v at current latitude
            for (var latAngle=-latLimitAngle; latAngle<=latLimitAngle; latAngle+=angleIncr) {
                latRadius = Math.cos(latAngle); // radius of current latitude
                latY = Math.sin(latAngle); // height at current latitude
                latV = (latAngle + Math.PI/2) / Math.PI; // 0 at south pole, 1 at north
                for (var longAngle = 0; longAngle < 2*Math.PI; longAngle+=angleIncr) { // for each long
                    ellipsoidVertices.push(latRadius*Math.sin(longAngle),latY,latRadius*Math.cos(longAngle));
                    ellipsoidUVs.push(longAngle/(2*Math.PI),latV);
                } // end for each longitude
                ellipsoidVertices.push(0,latY,latRadius); // seam: repeat the ring's first vertex...
                ellipsoidUVs.push(1,latV); // ...but with u = 1
            } // end for each latitude
            ellipsoidVertices.push(0,1,0); // add north pole
            ellipsoidUVs.push(0.5,1);
            ellipsoidVertices = ellipsoidVertices.map(function(val,idx) { // position and scale ellipsoid
                switch (idx % 3) {
                    case 0: // x
                        return(val*currEllipsoid.a+currEllipsoid.x);
                    case 1: // y
                        return(val*currEllipsoid.b+currEllipsoid.y);
                    case 2: // z
                        return(val*currEllipsoid.c+currEllipsoid.z);
                } // end switch
            }); 

            // make normals using the ellipsoid gradient equation
            // resulting normals are unnormalized: we rely on shaders to normalize
            var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
            ellipsoidNormals = ellipsoidNormals.map(function(val,idx) { // calculate each normal
                switch (idx % 3) {
                    case 0: // x
                        return(2/(currEllipsoid.a*currEllipsoid.a) * (val-currEllipsoid.x));
                    case 1: // y
                        return(2/(currEllipsoid.b*currEllipsoid.b) * (val-currEllipsoid.y));
                    case 2: // z
                        return(2/(currEllipsoid.c*currEllipsoid.c) * (val-currEllipsoid.z));
                } // end switch
            }); 
            
            // make triangles, from south pole to middle latitudes to north pole
            var ellipsoidTriangles = []; // triangles to return
            var ringSize = numLongSteps+1; // vertices per ring, including the seam duplicate
            for (var whichLong=1; whichLong<=numLongSteps; whichLong++) // south pole
                ellipsoidTriangles.push(0,whichLong,whichLong+1);
            var llVertex; // lower left vertex in the current quad
            for (var whichLat=0; whichLat<(numLongSteps/2 - 2); whichLat++) { // middle lats
                for (var whichLong=0; whichLong<numLongSteps; whichLong++) {
                    llVertex = whichLat*ringSize + whichLong + 1;
                    ellipsoidTriangles.push(llVertex,llVertex+ringSize,llVertex+ringSize+1);
                    ellipsoidTriangles.push(llVertex,llVertex+ringSize+1,llVertex+1);
                } // end for each longitude
            } // end for each latitude
            for (var whichLong=llVertex+2; whichLong<llVertex+numLongSteps+2; whichLong++) // north pole
                ellipsoidTriangles.push(whichLong,ellipsoidVertices.length/3-1,whichLong+1);
        } // end if good number longitude steps
        return({vertices:ellipsoidVertices, normals:ellipsoidNormals, uvs:ellipsoidUVs, triangles:ellipsoidTriangles});
    } // end try
    
    catch(e) {
        console.log(e);
    } // end catch
} // end make ellipsoid
