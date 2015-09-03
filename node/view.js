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
var material =  new THREE.MeshLambertMaterial( { color:0xffffff, shading: THREE.FlatShading } );

var mesh = new THREE.Mesh( geometry, material );

var rotMult = 1.0;

var axis = new THREE.Vector3();
var angle = 0.0;

init();
animate();

function init() {	
	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.z = 500;
	// world

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );
	
	scene.add( mesh );


	// lights

	light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 1, 1, 1 );
	scene.add( light );

	light = new THREE.DirectionalLight( 0x002288 );
	light.position.set( -1, -1, -1 );
	scene.add( light );

	light = new THREE.AmbientLight( 0x222222 );
	scene.add( light );


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

	console.log(axis);
	axis.x = targetRotationY;
	axis.y = targetRotationX;

	axis.normalize();

	//geometry.rotation.y = geometry.rotation.y += ( targetRotation - geometry.rotation.y ) * 0.05;
	var q = new THREE.Quaternion();
//	q.setFromAxisAngle( axis, angle );
//	q.set(1 + targetRotation, 1, 1, 1).normalize();
	q.setFromAxisAngle( axis, 1);
	mesh.setRotationFromQuaternion(q);

	renderer.render( scene, camera );	
	stats.update();	
}

function render() {	

	
}