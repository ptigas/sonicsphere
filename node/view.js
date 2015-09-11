var socket = io();
socket.connect('http://127.0.0.1:3000');

var icosahedron = new window.Icosahedron();
var external_point = window.ExternalPoint;

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

var rotMult = 1.0;

var axis = new THREE.Vector3();
var angle = 0.0;

// ray of the raycaster
var line_material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 3,
        fog: true
    });
var line_geometry = new THREE.Geometry();    
line_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
line_geometry.vertices.push(external_point);
var line = new THREE.Line(line_geometry, line_material);

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
	
	scene.add( icosahedron.mesh );

	// ray	
	scene.add(line);

	// lights
	light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 1, 1, 1 );
	scene.add( light );

	light = new THREE.DirectionalLight( 0x002288 );
	light.position.set( -1, -1, -1 );
	scene.add( light );

	light = new THREE.AmbientLight( 0x222222 );
	scene.add( light );

	// add sphere
	// scene.add(sphere());

	// renderer
	renderer = new THREE.WebGLRenderer( { antialias: false } );
	renderer.setClearColor( scene.fog.color );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	container = document.getElementById( 'container' );
	container.appendChild( renderer.domElement );

	/*
	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild( stats.domElement );
	*/

	// some events
	window.addEventListener( 'mousedown', onDocumentMouseDown, false );
	window.addEventListener( 'touchstart', onDocumentTouchStart, false );
	window.addEventListener( 'touchmove', onDocumentTouchMove, false );
	window.addEventListener( 'resize', onWindowResize, false );

	// change colors of facets
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

/*
	//console.log(axis);
	axis.x = targetRotationY;
	axis.y = targetRotationX;

	axis.normalize();

	console.log((mouseX - mouseXOnMouseDown)  + " " + targetRotationY);

	//geometry.rotation.y = geometry.rotation.y += ( targetRotation - geometry.rotation.y ) * 0.05;
	var q = new THREE.Quaternion();
//	q.setFromAxisAngle( axis, angle );
//	q.set(1 + targetRotation, 1, 1, 1).normalize();
	q.setFromAxisAngle( axis, 1);
	//icosahedron.mesh.setRotationFromQuaternion(q);
	//icosahedron.mesh.position.applyEuler(new THREE.Euler((mouseX - mouseXOnMouseDown), (mouseY - mouseYOnMouseDown), 0, 'XYZ'));
	var rotation = new THREE.Vector3((mouseY - mouseYOnMouseDown)*0.0002, (mouseX - mouseXOnMouseDown)*0.0002, 0);
	//rotation.applyMatrix4(icosahedron.mesh.matrixWorld);

	icosahedron.mesh.rotateX( rotation.x );
	icosahedron.mesh.rotateY( rotation.y );

	*/

	// ray casting
	icosahedron.rayCasting();

	renderer.render( scene, camera );	
	//stats.update();	
}

function render() {	

	
}

socket.on('q', function(data) {
	var rotateQuaternion = new THREE.Quaternion(data.q[0], data.q[1], data.q[2], data.q[3]);
	icosahedron.mesh.setRotationFromQuaternion(rotateQuaternion);
});