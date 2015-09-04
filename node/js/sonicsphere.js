//"use strict";

var nodejs_mode = false;
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  nodejs_mode = true;
}

if (nodejs_mode) {
  var THREE = require('three');
}

(function(THREE) {
  function compute_centroid(facet, vertices) {    
    var va = vertices[facet.a];
    var vb = vertices[facet.b];
    var vc = vertices[facet.c];

    return new THREE.Vector3(
      (va.x + vb.x + vc.x)/3,
      (va.y + vb.y + vc.y)/3,
      (va.z + vb.z + vc.z)/3
    );
  }

  var external_point = new THREE.Vector3(-200, -200, 100);

  /*
   * Main icosahedron class
   */
  function Icosahedron() {
    // define icosahedron geometry
    THREE.IcosahedronGeometry = function ( radius, detail ) {
      var t = ( 1 + Math.sqrt( 5 ) ) / 2;

      var vertices = [
        - 1,  t,  0,    1,  t,  0,   - 1, - t,  0,    1, - t,  0,
         0, - 1,  t,    0,  1,  t,    0, - 1, - t,    0,  1, - t,
         t,  0, - 1,    t,  0,  1,   - t,  0, - 1,   - t,  0,  1
      ];

      var indices = [
         0, 11,  5,    0,  5,  1,    0,  1,  7,    0,  7, 10,    0, 10, 11,
         1,  5,  9,    5, 11,  4,   11, 10,  2,   10,  7,  6,    7,  1,  8,
         3,  9,  4,    3,  4,  2,    3,  2,  6,    3,  6,  8,    3,  8,  9,
         4,  9,  5,    2,  4, 11,    6,  2, 10,    8,  6,  7,    9,  8,  1
      ];

      THREE.PolyhedronGeometry.call( this, vertices, indices, radius, detail );

      this.type = 'IcosahedronGeometry';

      this.parameters = {
        radius: radius,
        detail: detail
      };
    };

    THREE.IcosahedronGeometry.prototype = Object.create( THREE.Geometry.prototype );
    THREE.IcosahedronGeometry.prototype.constructor = THREE.IcosahedronGeometry;

    this.geometry = new THREE.IcosahedronGeometry( 100 );
    this.material =  new THREE.MeshLambertMaterial({  
      shading: THREE.FlatShading,
      vertexColors: THREE.FaceColors
    });
    this.mesh = new THREE.Mesh( this.geometry, this.material );

    this.setRotationFromQuaternion = function(a, b, c, d) {
      var q = new THREE.Quaternion(a, b, c, d);      
      this.mesh.setRotationFromQuaternion(q);
    }

    this.rayCasting = function() {
      var min_dist, min_f = null;

      for ( f = 0, fl = this.geometry.faces.length ; f < fl; f ++ ) {   
        var centroid = compute_centroid(this.geometry.faces[f], this.geometry.vertices);
        centroid.applyMatrix4(this.mesh.matrixWorld);
        var dist = centroid.distanceTo(external_point);

        if (min_f == null || min_dist > dist) {
          min_dist = dist;
          min_f = f;
        }   

        if (!nodejs_mode) {
          this.geometry.faces[f].color.setHex( 0xff0000 );
        }
      }

      if (!nodejs_mode) {
        this.geometry.faces[min_f].color.setHex( 0xffff00 ); 
        this.geometry.colorsNeedUpdate = true;
      } else {
        //console.log(min_dist);
      }
    }
  }    

  /*
   * Add exports here
   */
  function add_exports(object) {
    object.Icosahedron = Icosahedron;
    object.ExternalPoint = external_point;    
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    add_exports(module.exports);
  }  else {
    add_exports(window);
  }
  
})(THREE);