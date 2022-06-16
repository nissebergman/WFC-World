// Total size of WFC render and 3D-world
let totalSize = 10;

// Cell size
let cell_size = 38;

const bufferCanvas = document.getElementById('buffer-canvas');
let cBuffer = bufferCanvas.getContext('2d');
bufferCanvas.width = cell_size * totalSize;
bufferCanvas.height = cell_size * totalSize;

const drawingCanvas = document.getElementById('drawing-canvas');
drawingCanvas.width = cell_size * totalSize;
drawingCanvas.height = cell_size * totalSize;

let grassArray = []

/* 
WFC implementation based on code from https://codepen.io/sketchpunk/pen/oNjwvbM.
Original author comments has been kept since they do a good job explaining the algorithm.
Changes has been made adding mountain tiles to the algorithm, generating a canvas from the resulting table
and consequently loading the canvas as a texture into ThreeJS.
*/


// Automatically generating rules based on constraints.

function parse_matrix_rules( m ){
	let ylen		= m.length,		// Height of the Matrix
		xlen		= m[0].length,	// Width of the Matrix
		x_max		= xlen - 1,		// Boundary on X
		y_max 		= ylen - 1, 	// Boundary on Y
		len 		= xlen * ylen,	// Total cells
		tiles		= {},			// List of Tile Weights
		tile_ary	= [],			// Array of tile names
		r_keys 	= {},				// Rules in simple key format.
		tile, y, x;					

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// LOCAL FUNCTIONS
	// Rule sets, save as unique.
	let add_rule = ( a, b, dir )=>{
		let key = a + "_" + b + "_" + dir;
		if( !r_keys[ key ] ) r_keys[ key ] = true;
	};

	// Save tile name & accordance, This is the WEIGHT value for WFC.
	let add_tile = ( a )=>{
		if( tiles[ a ] )	tiles[ a ]++;
		else{
			tiles[ a ] = 1;
			tile_ary.push( a );
		}
	}

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Go through every cell, and check what Tile is next to what tile.
	// be it in the following directions, UP, Down, Left, Right.
	for( let i=0; i < len; i++ ){
		y		= Math.floor( i / xlen );		// Cell to inspect
		x		= ( i % xlen );
		tile 	= m[y][x];
		
		add_tile( tile );

		if( x > 0 )		add_rule( tile,  m[y][x-1], "LEFT" );		
		if( x < x_max )	add_rule( tile,  m[y][x+1], "RIGHT" );
		if( y > 0 )		add_rule( tile,  m[y-1][x], "UP" );
		if( y < y_max )	add_rule( tile,  m[y+1][x], "DOWN" );
		}
	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~-
	return { tiles, rules:r_keys, tile_ary };
}

// Create a Matrix where each cell contains all possible tiles
// The idea is we start with all possibilites then we start to 
// widdle away tiles that dont fit with their neighbors.
function gen_cell_matrix( list=[] ){
	let r, row, cells = new Array( HEIGHT );
	for( let i=0; i < HEIGHT; i++ ){						// Create Rows
		row = new Array( WIDTH );
		for( r=0; r < WIDTH; r++ ) row[ r ] = [...list];	// Columns with tile List.
		cells[ i ] = row;
	}
	return cells;
}

// Check if we are all done successful. 
// Requires every cell to only have 1 tile left, no more, no less.
// I do not check for or Handle failure, WFC can lead to cells having
// NO tiles. It happens for time to time, normally just reset and try
// again at a new starting tile.
function is_all_collapsed( cells ){
	let x,y;
	for( y=0; y < cells.length; y++ ){
		for( x=0; x < cells[y].length; x++ ){
			if( cells[y][x].length > 1 ) return false;
		}
	}
	return true;
}

// Find the Cell with the least Probability Score
// Which Kinda means which cell has the least available tiles with the least total weight
// The main goal is that, the cells with the least score, has less choices and better chances
// of collapsing quickly without error.
function find_entropy_cell( cells, tiles ){
	let x, y, c, entropy, entropy_rnd,
		min		= Infinity,
		min_x	= 0,
		min_y	= 0;

	for( y=0; y < cells.length; y++ ){
		for( x=0; x < cells[y].length; x++ ){
			
			c = cells[y][x];
			if( c.length == 1 ) continue;	// Skip and Cells that have been collapsed.

			entropy		= shannon_entropy( c, tiles );			// Calc some Probabiity Value based on the Tile Weights available.
			entropy_rnd	= entropy - ( Math.random() * 0.001 );	// Most cells will have the same Prob if no attempt to collapse, 
																// so a bit of random lets us pick a "Random" cell within the
																// the cells with the least probability score when all is equal.
			if( entropy_rnd < min ){	// Found a possible cell that has the least probability.
				min		= entropy_rnd;
				min_x	= x;
				min_y	= y;
			}
		}
	}

	return [ min_x, min_y ];
}

// https://en.wiktionary.org/wiki/Shannon_entropy
function shannon_entropy( cell, tiles ){
	let c, weight,
		total_weight		= 0,
		total_log_weight	= 0;

	for( c of cell ){
		weight				= tiles[ c ];
		total_weight		+= weight;
		total_log_weight	+= weight * Math.log( weight );
	}

	return Math.log( total_weight ) - ( total_log_weight / total_weight );
}

// Grab a cell, then out of the available tiles in it, pick one
// randomly based on the weight of the cell.
function collapse_cell( pos, cells, tiles ){
	let w, rnd_weight, 
		cell		= cells[ pos[1] ][ pos[0] ],		// Get Tiles array for the cell.
		t_weight	= 0, 
		weights		= new Array();

	// Create list of weights, plus compute total weight.
	// We use the total weight as a way to randomly pix a
	// tile as the only tile this cell will have.
	for( let c of cell ){
		w			= tiles[ c ];
		t_weight	+= w;
		weights.push( w );
	}

	// Apply a Random Number to the total Weight,
	// This will generate a number smaller then total weight.
	rnd_weight = Math.random() * t_weight; 

	// Loop through all the available tile weights for this cell
	for( let i=0; i < weights.length; i++ ){

		// Since Random total Weight is less then Total, this makes sure
		// that at some point it'll be in the negative when we keep subtracting
		// weight before we run out of weights for the process.
		// Since the random number gives an unpredicted reduction and tiles
		// are not in order by their weight, its a nice way to randomly
		// pick something, Larger weighted tiles will have a greater chance of
		// winning out which is what we'd like to happen.
		rnd_weight -= weights[ i ];
		if( rnd_weight < 0 ) return cells[ pos[1] ][ pos[0] ] = [ cell[i] ];	// Replace cell with just the Winning Tile.
	}

	return null;
}

// At a starting cell, check its neighbor cells to see if any tile does NOT
// fit with any of the starting cell's tiles. If any tile is removed from
// a cell, then its neighbors will also be checked in the same way for that
// modified cell. It will then spread like wild fire to any cell that changes
function propagate( start_pos, cells, tiles, rules ){
	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	let pos,
		stack		= [ start_pos ];	// Start our process with a collapsed cell.

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// LOCAL FUNCTION AND CONSTANTS
	const UP		= [ 0,-1];
	const RIGHT		= [ 1, 0];
	const DOWN		= [ 0, 1];
	const LEFT		= [-1, 0];
	const DIRS		= [ UP, RIGHT, DOWN, LEFT ];
	const DIR_NAMES	= [ "UP", "RIGHT", "DOWN", "LEFT" ];

	// Shift position in some direction
	let get_dir_pos = ( p, d, out )=>{
		out[ 0 ] = p[0] + d[0];
		out[ 1 ] = p[1] + d[1];
		return !( out[0] < 0 || out[0] >= WIDTH || out[1] < 0 || out[1] >= HEIGHT );
	};

	// Local function to get Tiles from a Cell
	let get_tiles = p=>cells[ p[1] ][ p[0] ];

	// Remove file from the cell matrix
	let remove_tile	= ( p, t )=>{
		let ary = cells[ p[1] ][ p[0] ];
		let idx = ary.indexOf( t );
		if( idx != -1 ) ary.splice( idx, 1 );
		//console.log( "---- FILTER", cells[ p[1] ][ p[0] ]  )	;
	};

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	let passes = 0,
		dir_name, main_tiles, chk_tiles,  ct, mt, cti,
		idx,  modified, compatible_cnt, key;

	while( (pos = stack.pop()) && passes < PROP_LMT ){
		// Get the Tiles available for the Cell we are going to process.
		main_tiles = get_tiles( pos );
		//console.log("------------------------------------------");
		//console.log( "- MAIN CELL", pos, main_tiles );

		if( main_tiles.length == 0 ){
			//console.log("ERROR - MAIN TILES EMPTY");
			return;
		}

		// We process the cell by checking its neighbor cells from each known direction
		for( idx=0; idx < 4; idx++ ){
			//console.log( DIR_NAMES[ idx ], DIRS[ idx ] );

			//-----------------------------------------
			// Get a Neighbor Cell based on the current direction
			// we are scanning.
			let chk_pos = [0,0];	// Must LET, it gets saved to the stack, else we can cause errors modifing pointers
			dir_name = DIR_NAMES[ idx ];
			if( ! get_dir_pos( pos, DIRS[ idx ], chk_pos ) ){ continue; break; }

			//-----------------------------------------
			// Get all the vailable tiles on the neighbor cell.
			chk_tiles = get_tiles( chk_pos );
			if( chk_tiles.length == 0 ){ return; }

			//console.log( ":::::");
			//console.log( "-- DIR CHECK", dir_name, "OF", main_tiles );
			//console.log( "--- CHECK CELL", chk_pos, chk_tiles );

			//-----------------------------------------
			// Loop over all the Neighbor cells, Then check if any of them
			// is allowed to exists at this direction from any of the MAIN CELL's tiles.
			// Since we're deleting from the array by reference, work backwards to not mess up indexing.

			modified = false;
			for( cti = chk_tiles.length-1; cti >=0; cti-- ){ 
				ct = chk_tiles[ cti ];

				//.............................
				// If the Tile is not compatible with NONE of the main tile list
				compatible_cnt = 0;
				for( mt of main_tiles ){	
					key = mt + "_" + ct + "_" + dir_name;  // ex. L_C_UP
					//console.log( "---- CHK RULE", key, rules[ key ] );
					//if( !rules[ key ] ) bad_tiles.add( ct );
					if( rules[ key ] ){ compatible_cnt++; break; }
				}

				//console.log( "---- COMPATIBLE COUNT:", ct, compatible_cnt );
				//.............................
				// if a tile is NOT compatible with any of the main tiles, Then its worthless
				// so remove it from our tile array. This will effect the array in the cell matrix
				// since the changed is done by reference.
				if( compatible_cnt == 0 ){
					remove_tile( chk_pos, ct );
					modified = true;
				}
			}

			//-----------------------------------------
			// if we had to remove tiles, then add the cell to the stack 
			// because its change, effects it's neighbors.
			if( modified ) stack.push( chk_pos );
			//break;
		}

		passes++;
		//break;
	}
	//console.log( "Propagate Pass Count", passes );
}

// Fill the canvas as cells.
function fill_canvas( x, y, cell_width, cell_height, color){
	cBuffer.fillStyle = color;
	cBuffer.fillRect(x * cell_width, y * cell_height , cell_width, cell_height);
	
}



// How to Render the Cell Matrix Data after the algorithm has done
// its work.
function renderWFC( tbl, cells ){
	let x, y, tiles, t,
		rows = tbl.rows;

	// Create cellstyle 2d rendering of WFC for easy visualization 
	// and fill canvas of WFC to be used with ThreeJS as texture. 
	for( y=0; y < HEIGHT; y++ ){
		for( x=0; x < WIDTH; x++ ){
			tiles	= cells[y][x];
			td		= rows[y].cells[x];
			t		= ( tiles.length == 0 )? "" : ( tiles.length == 1 )? tiles[0] : tiles.length;

			//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
			td.innerHTML = t;	// View Cell Results
			
			// Color the Table cell based on the CELL Result
			switch( t ){
				case "S": 
					td.className = "TS";
					fill_canvas(x, y, cell_size, cell_size, 'blue');
					break;
				case "C":
					td.className = "TC";
					fill_canvas(x, y, cell_size, cell_size, 'darkorange');
					break;
				case "L": 
					td.className = "TL";
					fill_canvas(x, y, cell_size, cell_size, 'green');
					grassArray.push({
						x: x,
						y: y
					})
					break;
				case "M":
					td.className = "TM";
					fill_canvas(x, y, cell_size, cell_size, '#CCCCCC');
					break;
				case "": 
					td.className = "TERR";
					fill_canvas(x, y, cell_size, cell_size, 'red');
					break;
				default:  
					td.className = ""; 
					break;
			}
		}

	}

	// Take the buffer canvas and add blur to get smooth transitions in shader.
	let cDrawing = drawingCanvas.getContext('2d');
	cDrawing.filter = 'blur(12px)';
	cDrawing.drawImage(bufferCanvas,0,0);

	/* THREEJS IMPLEMENTATION */

	let camera, scene, renderer, controls;

	const dummy = new THREE.Object3D();

	init();
	animate();


	function init() {
		console.log(grassArray)
		camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 2000 );
		camera.position.z = 200;
		
		//Get blurred canvas
		const drawingCanvas = document.getElementById( 'drawing-canvas' );
		worldGeometry = new THREE.BoxGeometry(100, 2, 100, 100, 100, 100);

		uniforms = {
			canvasTexture: { value: new THREE.Texture(drawingCanvas) },
			grassTexture: { value: new THREE.ImageUtils.loadTexture("grass.jpg") },
			sandTexture: { value: new THREE.ImageUtils.loadTexture("sand.jpg") },
			seaTexture: { value: new THREE.ImageUtils.loadTexture("sea.jpg") },
			mountainTexture: { value: new THREE.ImageUtils.loadTexture("mountain.jpg") },
			cellSize: {value: cell_size },
			time: { value: 1.0 }
		}

		worldMaterial = new THREE.ShaderMaterial( {
			uniforms: uniforms,
			vertexShader: document.getElementById( 'vertexShader' ).textContent,
			fragmentShader: document.getElementById( 'fragmentShader' ).textContent
		})

		scene = new THREE.Scene();
		worldPlane = new THREE.Mesh( worldGeometry, worldMaterial );

		/* -- GRASS -- */

		const grassGeometry = new THREE.InstancedBufferGeometry();
		const grassAmount = 20 * grassArray.length;

		var vertices = new THREE.BufferAttribute(new Float32Array ( grassAmount * 6 * 6), 3);

		vertices.setXYZ( 0, -.2, -1.5, 0 );
		vertices.setXYZ( 1, .2, -1.5, 0 );
		vertices.setXYZ( 2, -.2, 1.5, 0 );

		vertices.setXYZ( 3, -.2, 1.5, 0 );
		vertices.setXYZ( 4, .2, -1.5, 0 );
		vertices.setXYZ( 5, .2, 1.5, 0 );

		grassGeometry.addAttribute('position', vertices);
		console.log(grassAmount);
		console.log(grassArray.length)

		var offsets = new THREE.InstancedBufferAttribute( new Float32Array ( grassAmount * 6 ), 3, true, 1 );
		for ( var i = 0, ul = offsets.count; i < ul; i++ ) {

			//offsets.setXYZ( i, Math.random()*10 - 0.5, 0, Math.random()*10 - 0.5);
			offsets.setXYZ( i, (grassArray[Math.floor(i/40)].x * 3.4 + Math.random()*3) - 23.5, -6, (grassArray[Math.floor(i/40)].y * 3.4 + Math.random()*3) - 23.5);
		}

		grassGeometry.addAttribute( 'offset', offsets );
		


		var grassMaterial = new THREE.RawShaderMaterial( {

			uniforms: {
				time: { value: 1.0 },
				sineTime: { value: 1.0 }
			},
			vertexShader: document.getElementById( 'vertexShader2' ).textContent,
			fragmentShader: document.getElementById( 'fragmentShader2' ).textContent,
			side: THREE.DoubleSide,
			transparent: true

		} );

		var grassMesh = new THREE.InstancedMesh (grassGeometry, grassMaterial, grassAmount * 2);

  		grassMesh.instanceMatrix.needsUpdate = true;
		scene.add(grassMesh)

		scene.add( worldPlane );


		c = drawingCanvas.getContext('2d');

		// Activate for wireframe
		// var geometry2 = new THREE.WireframeGeometry( geometry ); // or EdgesGeometry
		// var material2 = new THREE.LineBasicMaterial( { color: 0x000000, transparent: true } );
		// var wireframe = new THREE.LineSegments( geometry2, material2 );
		// plane.add( wireframe );

		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( cell_size * 10, cell_size * 10);
		document.body.appendChild( renderer.domElement );

		window.addEventListener( 'resize', onWindowResize );

		controls = new THREE.OrbitControls( camera, renderer.domElement );

		controls.update();


	}
	
	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	function animate() {

		var time = performance.now();
		var grass = scene.children[0];

		grass.material.uniforms.sineTime.value = time * 0.0004;

		var world = scene.children[1];

		world.material.uniforms.time.value = time * 0.0004;

		controls.update();
		requestAnimationFrame ( animate );

		renderer.render( scene, camera );
		
		worldPlane.material.uniforms.canvasTexture.value.needsUpdate = true;


	}

}


//###############################################################################
const WIDTH     = totalSize;
const HEIGHT    = totalSize;
const TBL		= document.getElementById( "tbl" );

const PASS_LMT	= totalSize*10;	// How many passes to go through the matrix. Needs to be increased as totalSize is increased
const PROP_LMT	= 100;	// How many passes in the propagate to allow

// Generate HTML Table
(_=>{
	let i, r, j;
	for( i=0; i < HEIGHT; i++ ){
		r = TBL.insertRow();
		for( j=0; j < WIDTH; j++ ) r.insertCell().innerHTML = "x";
	}
})();


let rule_matrix = [
    ['L','L','L','L'],
    ['L','M','M','L'],
    ['L','M','M','L'],
    ['L','C','C','L'],
    ['C','S','S','C'],
    ['S','S','S','S'],
    ['S','S','S','S'],
];

function Run(){
	let info	= parse_matrix_rules( rule_matrix ),	// 1. Generate Tiles and Rules
		cells	= gen_cell_matrix( info.tile_ary ),		// 2. Create Matrix with each Cell Filled with all Possible Tiles
		passes	= 0,
		pos;

	do{

		pos = find_entropy_cell( cells, info.tiles );
		collapse_cell( pos, cells, info.tiles );

		propagate( pos, cells, info.tiles, info.rules );
		passes++;
	}while( !is_all_collapsed( cells ) && passes < PASS_LMT );

	//console.log( "PASS COUNT", passes );
	renderWFC( TBL, cells );
}

window.addEventListener( "load", Run );