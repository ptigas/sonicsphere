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

var external_point = new THREE.Vector3(-200, -200, 100);

THREE.IcosahedronGeometry.prototype = Object.create( THREE.Geometry.prototype );
THREE.IcosahedronGeometry.prototype.constructor = THREE.IcosahedronGeometry;

var container, stats;

var camera, controls, scene, renderer;

var cross;

var targetRotationX = 0;
var targetRotationOnMouseDownX = 0;
var targetRotationY = 0;
var targetRotationOnMouseDownY = 0;

var mouseX = 0;
var mouseY = 0;
var mouseXOnMouseDown = 0;
var mouseYOnMouseDown = 0;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

var geometry = new THREE.IcosahedronGeometry( 100 );
var material =  new THREE.MeshLambertMaterial({
	//color:0xff0000, 
	shading: THREE.FlatShading,
	vertexColors: THREE.FaceColors
});
var mesh = new THREE.Mesh( geometry, material );

// line
var line_material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 3,
        fog: true
    });
var line_geometry = new THREE.Geometry();    
line_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
line_geometry.vertices.push(external_point);
var line = new THREE.Line(line_geometry, line_material);

var rotMult = 1.0;

var axis = new THREE.Vector3();
var angle = 0.0;

function compute_centroid(facet) {
	var vertices = geometry.vertices;
	var va = vertices[facet.a];
	var vb = vertices[facet.b];
	var vc = vertices[facet.c];

	return new THREE.Vector3(
		(va.x + vb.x + vc.x)/3,
		(va.y + vb.y + vc.y)/3,
		(va.z + vb.z + vc.z)/3
	);
}

function ray_casting() {
	var min_dist, min_f = null;

	for ( f = 0, fl = geometry.faces.length ; f < fl; f ++ ) {
		//console.log(faces[f]);
		//geometry.faces[f].color.setHex( Math.random() * 0xff0000 );			
		var centroid = compute_centroid(geometry.faces[f])
		centroid.applyMatrix4(mesh.matrixWorld);
		var dist = centroid.distanceTo(external_point);

		
		if (min_f == null || min_dist > dist) {
			min_dist = dist;
			min_f = f;
		}		

		geometry.faces[f].color.setHex( 0xff0000 );
		//var v = mesh.matrixWorld.multiplyVector3(centroid);		

		//console.log(v);
		//console.log(centroid);
		//break;
	}

	geometry.faces[min_f].color.setHex( 0xffff00 );	
	geometry.colorsNeedUpdate = true;
}

init();
animate();

function sphere() {
	var geometry = new THREE.SphereGeometry( 5, 32, 32 );
	var material = new THREE.MeshBasicMaterial( {color: 0xff0000, vertexColors: THREE.FaceColors} );
	var sphere = new THREE.Mesh( geometry, material );
	sphere.position.copy(external_point);
	return sphere;
}

function init() {	
	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.z = 500;

	// world
	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2( 0xcccccc, 0.0018 );
	
	scene.add( mesh );

	// ray	
	scene.add(line);

	// add mesh to scene
	//scene.add(mesh);	

	// lights
	light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 1, 1, 1 );
	scene.add( light );

	light = new THREE.DirectionalLight( 0x002288 );
	light.position.set( -1, -1, -1 );
	scene.add( light );

	light = new THREE.AmbientLight( 0x222222 );
	scene.add( light );

	scene.add(sphere());

	// renderer
	renderer = new THREE.WebGLRenderer( { antialias: false } );
	renderer.setClearColor( scene.fog.color );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container = document.getElementById( 'container' );
	container.appendChild( renderer.domElement );

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild( stats.domElement );

	//
	window.addEventListener( 'mousedown', onDocumentMouseDown, false );
	window.addEventListener( 'touchstart', onDocumentTouchStart, false );
	window.addEventListener( 'touchmove', onDocumentTouchMove, false );

	window.addEventListener( 'resize', onWindowResize, false );
	//

	// change colors of facets	
	for ( f = 0, fl = geometry.faces.length; f < fl; f ++ ) {
		geometry.faces[f].color.setHex( 0xff0000 );
	}

	render();
}

function onDocumentMouseDown( event ) {

	event.preventDefault();

	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );
	document.addEventListener( 'mouseout', onDocumentMouseOut, false );

	mouseXOnMouseDown = event.clientX - windowHalfX;
	mouseYOnMouseDown = event.clientY - windowHalfY;
	targetRotationOnMouseDownX = targetRotationX;
	targetRotationOnMouseDownY = targetRotationY;
}

function onDocumentMouseMove( event ) {

	mouseX = event.clientX - windowHalfX;
	mouseY = event.clientY - windowHalfY;

	targetRotationX = targetRotationOnMouseDownX + ( mouseX - mouseXOnMouseDown ) * 0.02;
	targetRotationY = targetRotationOnMouseDownY + ( mouseY - mouseYOnMouseDown ) * 0.02;
}

function onDocumentMouseUp( event ) {

	document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
	document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
	document.removeEventListener( 'mouseout', onDocumentMouseOut, false );

}

function onDocumentMouseOut( event ) {

	document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
	document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
	document.removeEventListener( 'mouseout', onDocumentMouseOut, false );

}

function onDocumentTouchStart( event ) {

	if ( event.touches.length === 1 ) {

		event.preventDefault();

		mouseXOnMouseDown = event.touches[ 0 ].pageX - windowHalfX;
		targetRotationOnMouseDown = targetRotation;

	}
}

function onDocumentTouchMove( event ) {

	if ( event.touches.length === 1 ) {

		event.preventDefault();

		mouseX = event.touches[ 0 ].pageX - windowHalfX;
		targetRotation = targetRotationOnMouseDown + ( mouseX - mouseXOnMouseDown ) * 0.05;

	}

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

	render();
}

function animate() {
	requestAnimationFrame( animate );	

	//console.log(axis);
	axis.x = targetRotationY;
	axis.y = targetRotationX;

	axis.normalize();

	//geometry.rotation.y = geometry.rotation.y += ( targetRotation - geometry.rotation.y ) * 0.05;
	var q = new THREE.Quaternion();
//	q.setFromAxisAngle( axis, angle );
//	q.set(1 + targetRotation, 1, 1, 1).normalize();
	q.setFromAxisAngle( axis, 1);
	mesh.setRotationFromQuaternion(q);

	// ray casting
	ray_casting();

	renderer.render( scene, camera );	
	stats.update();	

	//console.log(mesh.matrixWorld);
}

function render() {	

	
}