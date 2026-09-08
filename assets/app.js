/* Callboard front end: renders views from data shipped with the page; the player persists across views. */
( () => {
	const G = window.CALLBOARD || { sets: [], settings: {}, text: {} };
	const S = G.settings || {},
		T = G.text || {};
	const $ = ( id ) => document.getElementById( id );
	const ls = {
		get: ( k ) => {
			try {
				return JSON.parse( localStorage.getItem( k ) );
			} catch {
				return null;
			}
		},
		set: ( k, v ) => {
			try {
				localStorage.setItem( k, JSON.stringify( v ) );
			} catch {}
		},
	};
	const retrigger = ( el, cls ) => {
		el.classList.remove( cls );
		void el.offsetWidth;
		el.classList.add( cls );
	};
	const fmt = ( s ) =>
		isFinite( s ) && s >= 0
			? `${ Math.floor( s / 60 ) }:${ String(
					Math.floor( s % 60 )
			  ).padStart( 2, '0' ) }`
			: '0:00';
	const tpl = ( s, ...a ) =>
		s.replace( /%(\d)\$s|%s/g, ( m, n ) => a[ n ? n - 1 : 0 ] );
	const reduce = () =>
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	const setBy = ( slug ) => G.sets.find( ( s ) => s.slug === slug );

	( window.requestIdleCallback || ( ( f ) => setTimeout( f, 1000 ) ) )(
		() => {
			if ( 'serviceWorker' in navigator ) {
				navigator.serviceWorker.register( '/sw.js' ).catch( () => {} );
			}
		}
	);
	// A new version took over underneath this page: say so, quietly, and let a tap bring it in.
	navigator.serviceWorker?.addEventListener( 'message', ( e ) => {
		if (
			e.data?.type !== 'callboard:updated' ||
			e.data.version === G.version
		) {
			return;
		}
		const bar = $( 'update' );
		if ( bar ) {
			bar.hidden = false;
		}
	} );
	document.addEventListener( 'click', ( e ) => {
		if ( e.target.closest( '#update' ) ) {
			location.reload();
		}
	} );
	try {
		if ( navigator.audioSession ) {
			navigator.audioSession.type = 'playback';
		}
	} catch {}
	const isIOS = /iphone|ipad|ipod/i.test( navigator.userAgent );
	const standalone =
		window.matchMedia( '(display-mode: standalone)' ).matches ||
		navigator.standalone === true;
	document.documentElement.classList.toggle( 'is-standalone', standalone );
	// Haptics. iOS has no Vibration API; since iOS 18 a switch control toggled inside a user gesture clicks
	// with a haptic, and a label click forwards to it, so a fresh label and switch are made for every call
	// and thrown away. Everywhere else navigator.vibrate does the same job. Both fire only synchronously
	// inside a tap or a release: never from a timer, and never after an await.
	const haptic = ( ms = 10 ) => {
		if ( isIOS ) {
			try {
				const label = document.createElement( 'label' );
				label.setAttribute( 'aria-hidden', 'true' );
				label.style.display = 'none';
				const sw = document.createElement( 'input' );
				sw.type = 'checkbox';
				sw.setAttribute( 'switch', '' );
				label.appendChild( sw );
				document.head.appendChild( label );
				label.click();
				label.remove();
			} catch {}
			return;
		}
		try {
			navigator.vibrate?.( ms );
		} catch {}
	};
	// In-app browsers (Instagram, Facebook, TikTok, Snapchat, Messenger) hide Add to Home Screen; Safari has it.
	const inApp =
		/FBAN|FBAV|Instagram|Snapchat|TikTok|musical_ly|Messenger/i.test(
			navigator.userAgent
		) ||
		( isIOS && ! /Safari\//.test( navigator.userAgent ) );
	let installPrompt = null; // Chromium fires this; one tap then installs
	window.addEventListener( 'beforeinstallprompt', ( e ) => {
		e.preventDefault();
		installPrompt = e;
		paintTip();
	} );
	window.addEventListener( 'appinstalled', () => {
		installPrompt = null;
		ls.set( 'callboard:a2hs', 1 );
		paintTip();
	} );

	// ---- Confetti: triple-tap the big title (configured text, optional hearts)
	const burst = () => {
		if ( ! S.confetti ) {
			return;
		}
		const COUNT = 8;
		for ( let k = 0; k < COUNT; k++ ) {
			const el = document.createElement( 'span' );
			el.className = 'tt';
			el.textContent = S.hearts && k % 2 ? '♥' : S.confetti;
			el.setAttribute( 'aria-hidden', 'true' );
			el.style.left = `${ 8 + Math.random() * 80 }vw`;
			el.style.fontSize = `${ 1.2 + Math.random() * 0.9 }rem`;
			el.style.color = `hsl(${ Math.round(
				( k / COUNT ) * 330 + Math.random() * 12
			) } 85% 62%)`;
			document.body.appendChild( el );
			const drift = reduce() ? 0 : ( Math.random() - 0.5 ) * 40,
				tilt = reduce() ? 0 : ( Math.random() - 0.5 ) * 10;
			const rise = -(
				window.innerHeight *
				( 0.55 + Math.random() * 0.3 )
			);
			const anim = el.animate(
				[
					{ transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
					{ opacity: 0.85, offset: 0.12 },
					{ opacity: 0.85, offset: 0.7 },
					{
						transform: `translate(${ drift }px, ${ rise }px) rotate(${ tilt }deg)`,
						opacity: 0,
					},
				],
				{
					duration: 3200 + Math.random() * 900,
					delay: k * 200 + Math.random() * 200,
					easing: 'cubic-bezier(.15,.5,.25,1)',
					fill: 'forwards',
				}
			);
			anim.onfinish = () => el.remove();
			setTimeout( () => el.remove(), 7000 );
		}
	};
	let taps = [];
	document.addEventListener( 'pointerup', ( e ) => {
		if ( ! e.target.closest( 'h1' ) ) {
			return;
		}
		const now = Date.now();
		taps = taps.filter( ( t ) => now - t < 700 ).concat( now );
		if ( taps.length >= 3 ) {
			taps = [];
			burst();
		}
	} );

	// ---- Persistent player
	const audio = $( 'audio' ),
		deck = $( 'deck' ),
		nowTitle = $( 'now-title' ),
		toggle = $( 'toggle' ),
		seek = $( 'seek' ),
		seekFill = $( 'seek-fill' ),
		cur = $( 'cur' ),
		dur = $( 'dur' );
	const lyricsSheet = $( 'lyrics' ),
		lyricsList = $( 'lyrics-lines' ),
		openLyrics = $( 'open-lyrics' );
	if ( ! audio || ! deck ) {
		return;
	}

	let looper = null, // the gapless loop, when one is running (see the A-B loop section)
		looperCtx = null,
		looperBuf = null; // { url, buffer }
	let played = false; // true once this session has played anything; before that the set button reads "Play all"
	let queue = null,
		i = -1,
		seeking = false,
		rows = [],
		cues = [],
		cueEls = [],
		cueIdx = -1,
		lastSec = -1;
	const view = () => document.body.dataset.slug || '';
	const onQueuePage = () => !! queue && view() === queue.slug;
	const key = () => `callboard:${ queue.slug }`;

	// ---- Speed. HTMLMediaElement.preservesPitch keeps the key while the tempo drops, which is what a
	// rehearsal wants; the chip steps down through the presets and comes back round to full speed.
	const RATES = [ 1, 0.85, 0.75, 0.6, 0.5 ];
	const rateChip = $( 'rate' );
	let rate = RATES.includes( ls.get( 'callboard:rate' ) )
		? ls.get( 'callboard:rate' )
		: 1;
	const rateText = ( r ) => `${ r }×`;
	function setRate( r, save = true ) {
		rate = r;
		try {
			audio.preservesPitch = true;
			audio.webkitPreservesPitch = true;
		} catch {}
		audio.defaultPlaybackRate = r; // a new src resets playbackRate to this
		audio.playbackRate = r;
		looperStop(); // Web Audio has no preservesPitch; the element's loop takes over
		if ( rateChip ) {
			rateChip.textContent = rateText( r );
			rateChip.dataset.state = r === 1 ? '' : 'on';
			rateChip.setAttribute(
				'aria-label',
				r === RATES[ RATES.length - 1 ]
					? T.rate_reset
					: tpl( T.rate_label, rateText( r ) )
			);
		}
		if ( save ) {
			ls.set( 'callboard:rate', r );
		}
		positionState();
	}
	const stepRate = ( dir = 1 ) =>
		setRate(
			RATES[
				( RATES.indexOf( rate ) + dir + RATES.length ) % RATES.length
			]
		);
	rateChip?.addEventListener( 'click', () => {
		haptic();
		stepRate( 1 );
	} );
	setRate( rate, false ); // the chip reads the remembered speed before anything is loaded

	let analyser = null,
		eqRaf = 0;
	const ensureAnalyser = () => {
		if ( analyser || isIOS || ! window.AudioContext ) {
			return;
		}
		try {
			const ctx = new AudioContext();
			const src = ctx.createMediaElementSource( audio );
			analyser = ctx.createAnalyser();
			analyser.fftSize = 64;
			analyser.smoothingTimeConstant = 0.7;
			src.connect( analyser );
			analyser.connect( ctx.destination );
			audio.addEventListener( 'play', () =>
				ctx.resume().catch( () => {} )
			);
		} catch {
			analyser = null;
		}
	};
	let eqAnims = [];
	const eqStop = () => {
		eqAnims.forEach( ( a ) => a.cancel() );
		eqAnims = [];
		cancelAnimationFrame( eqRaf );
		eqRaf = 0;
		document.querySelectorAll( '.eq i' ).forEach( ( b ) => {
			b.style.transform = '';
		} );
		glowAnim?.cancel();
		glowAnim = null;
		if ( glow ) {
			coolDown( lastBright );
			lastBright = 0;
		}
	};
	let lastBright = 0;
	// ---- Meter: the light strip on the deck and the bars on the playing row. Sources, in order:
	// a live analyser (not iOS), the track's measured envelope (ten levels a second, from import), or a slow breath.
	const glow = $( 'deck-glow' );
	const envelope = ( t ) => {
		const e = queue?.tracks[ i ]?.levels;
		if ( ! e || t < 0 ) {
			return null;
		}
		const x = t * 10,
			k = Math.min( e.length - 1, Math.floor( x ) ),
			a = +e[ k ] / 9,
			b = +e[ Math.min( e.length - 1, k + 1 ) ] / 9;
		return a + ( b - a ) * ( x - k );
	};
	const glowHot = $( 'deck-glow-hot' ),
		glowHalo = $( 'deck-glow-halo' );
	// A filament's color follows its heat: near-black red when barely lit, through orange, to a pale yellow-white
	// at full current. Four stops, interpolated; the accent sits at the middle so the brand color is the working
	// temperature of the wire.
	const KELVIN = [
		[ 0, [ 74, 16, 0 ] ],
		[ 0.35, [ 190, 58, 12 ] ],
		[ 0.7, [ 255, 106, 46 ] ],
		[ 1, [ 255, 226, 178 ] ],
	];
	const heatColor = ( b ) => {
		let k = 1;
		while ( k < KELVIN.length - 1 && KELVIN[ k ][ 0 ] < b ) {
			k++;
		}
		const [ t0, c0 ] = KELVIN[ k - 1 ],
			[ t1, c1 ] = KELVIN[ k ],
			f = Math.min( 1, Math.max( 0, ( b - t0 ) / ( t1 - t0 ) ) );
		return `rgb(${ c0
			.map( ( v, n ) => Math.round( v + ( c1[ n ] - v ) * f ) )
			.join( ' ' ) })`;
	};
	const paintGlow = ( b ) => {
		const c = heatColor( b ); // continuous: no steps in the colour, so nothing to read as a flicker
		glow.style.color = c;
		if ( glowHalo ) {
			glowHalo.style.color = c;
		}
		glow.style.opacity = ( 0.25 + 0.75 * b ).toFixed( 3 );
		if ( glowHot ) {
			glowHot.style.opacity = ( 0.6 * b * b * b ).toFixed( 3 ); // the white heart only shows at the peaks
		}
		if ( glowHalo ) {
			glowHalo.style.opacity = ( 0.45 * b * b ).toFixed( 3 );
		}
	};
	// Cut the current and a filament does not go dark; it cools. Pause fades it out over a second and a half.
	let coolRaf = 0;
	const coolDown = ( from ) => {
		cancelAnimationFrame( coolRaf );
		if ( reduce() ) {
			paintGlow( 0 );
			return;
		}
		const t0 = performance.now();
		const step = ( now ) => {
			const k = Math.min( 1, ( now - t0 ) / 1500 );
			paintGlow( from * Math.pow( 1 - k, 2.2 ) ); // fast at first, then the long red tail
			if ( k < 1 ) {
				coolRaf = requestAnimationFrame( step );
			}
		};
		coolRaf = requestAnimationFrame( step );
	};
	let glowAnim = null;
	const eqStart = ( row ) => {
		eqStop();
		if ( reduce() ) {
			if ( glow ) {
				paintGlow( 0.5 );
			}
			return; // the static bars still mark the playing row
		}
		const bars = row ? [ ...row.querySelectorAll( '.eq i' ) ] : [];
		const data = analyser
			? new Uint8Array( analyser.frequencyBinCount )
			: null;
		const bands = [
			[ 1, 4 ],
			[ 4, 10 ],
			[ 10, 24 ],
		];
		const hasEnvelope = !! queue?.tracks[ i ]?.levels;
		if ( ! analyser && ! hasEnvelope ) {
			bars.forEach( ( bar, k ) =>
				eqAnims.push(
					bar.animate(
						[
							{ transform: 'scaleY(.35)' },
							{ transform: 'scaleY(1)' },
							{ transform: 'scaleY(.35)' },
						],
						{
							duration: [ 1100, 900, 1300 ][ k ] || 1000,
							delay: -k * 300,
							iterations: Infinity,
							easing: 'ease-in-out',
						}
					)
				)
			);
			if ( glow ) {
				glowAnim = glow.animate(
					[ { opacity: 0.25 }, { opacity: 0.7 }, { opacity: 0.25 } ],
					{
						duration: 2600,
						iterations: Infinity,
						easing: 'ease-in-out',
					}
				);
			}
			return;
		}
		let bright = 0,
			ember = 0,
			last = 0;
		cancelAnimationFrame( coolRaf ); // power is back on
		const tick = ( now = 0 ) => {
			const dt = last ? Math.min( 0.1, ( now - last ) / 1000 ) : 0.016;
			last = now;
			let levels;
			if ( analyser ) {
				analyser.getByteFrequencyData( data );
				levels = bands.map( ( [ a, b ] ) => {
					let sum = 0;
					for ( let n = a; n < b; n++ ) {
						sum += data[ n ];
					}
					return Math.min( 1, sum / ( b - a ) / 200 );
				} );
			} else {
				const t = audio.currentTime;
				levels = [
					envelope( t ),
					envelope( t - 0.12 ),
					envelope( t - 0.24 ),
				].map( ( v ) => ( v === null ? 0.3 : v ) );
			}
			bars.forEach( ( bar, k ) => {
				bar.style.transform = `scaleY(${ (
					0.3 +
					0.7 * levels[ k ]
				).toFixed( 2 ) })`;
			} );
			if ( glow ) {
				// a filament: it lights in ~90 ms and cools over ~400 ms, so peaks swell and settle rather than
				// twitch; a second, slower store (~1.4 s) holds the residual heat, so it never goes black
				// between phrases
				const target =
					levels[ 0 ] * 0.5 + levels[ 1 ] * 0.3 + levels[ 2 ] * 0.2;
				const tau = target > bright ? 0.09 : 0.4;
				bright += ( target - bright ) * ( 1 - Math.exp( -dt / tau ) );
				ember += ( bright - ember ) * ( 1 - Math.exp( -dt / 1.4 ) );
				lastBright = Math.max( bright, ember * 0.45 );
				paintGlow( Math.min( 1, lastBright ) );
			}
			eqRaf = requestAnimationFrame( tick );
		};
		tick();
	};
	function syncRows() {
		rows = [ ...document.querySelectorAll( '.track' ) ];
		const same = onQueuePage();
		rows.forEach( ( r, k ) => {
			const on = same && k === i;
			r.classList.toggle( 'active', on );
			r.classList.toggle( 'playing', on && ! audio.paused );
			r.setAttribute( 'aria-current', on ? 'true' : 'false' );
		} );
		if ( same && i >= 0 && ! audio.paused ) {
			eqStart( rows[ i ] );
		} else {
			eqStop();
		}
		const pa = $( 'play-all' );
		if ( pa ) {
			// the set's transport: starts the set, then mirrors the deck for this set
			const loaded = played && same && i >= 0;
			pa.textContent = ! loaded
				? T.play_all
				: audio.paused
				? T.resume
				: T.pause;
			pa.classList.toggle( 'is-playing', loaded && ! audio.paused );
		}
	}
	function setTitle( text, detail = '' ) {
		const mq = nowTitle.firstElementChild;
		mq.innerHTML = '';
		const a = document.createElement( 'span' );
		a.textContent = text;
		if ( detail ) {
			const d = document.createElement( 'small' );
			d.textContent = detail;
			a.appendChild( d );
		}
		mq.appendChild( a );
		nowTitle.classList.remove( 'marquee' );
		const width = a.getBoundingClientRect().width; // the span is inline; scrollWidth would read 0
		if ( width > nowTitle.clientWidth + 2 ) {
			const b = a.cloneNode( true );
			b.setAttribute( 'aria-hidden', 'true' );
			mq.appendChild( b );
			nowTitle.style.setProperty(
				'--mq-dur',
				`${ Math.max( 8, width / 28 ) }s`
			);
			nowTitle.classList.add( 'marquee' );
		}
		retrigger( nowTitle, 'swap' );
	}
	window.addEventListener( 'resize', () => {
		if ( i >= 0 ) {
			setTitle( queue.tracks[ i ].title );
		}
	} );
	const remember = () => {
		if ( queue && i >= 0 ) {
			ls.set( key(), { i, t: Math.floor( audio.currentTime || 0 ) } );
		}
	};
	const seekKnob = $( 'seek-knob' );
	let seekWidth = 0;
	const measureSeek = () => {
		seekWidth = seek.clientWidth - ( seekKnob ? seekKnob.offsetWidth : 0 );
	};
	window.addEventListener( 'resize', measureSeek );
	let lastStep = -1;
	let lastMask = -1;
	const setProgress = ( ratio ) => {
		if ( ! seekWidth ) {
			measureSeek();
		}
		const step = Math.round( ratio * 1000 );
		if ( step !== lastStep ) {
			lastStep = step;
			seek.value = step; // the control repaints on a value change, so only when the value changes
		}
		seekFill.style.transform = `scaleX(${ ratio })`;
		if ( wavePlayed ) {
			const pct = ( ratio * 100 ).toFixed( 2 );
			wavePlayed.style.clipPath = `inset(0 ${ ( 100 - pct ).toFixed(
				2
			) }% 0 0)`;
			// the playhead is the lamp: bars beside it burn, bars behind it cool toward ember. The mask is a
			// gradient the browser re-rasterises on every write, so it moves in quarter-percent steps
			const maskStep = Math.round( ratio * 400 );
			if ( maskStep !== lastMask ) {
				lastMask = maskStep;
				wavePlayed.style.maskImage = `linear-gradient(90deg, rgba(0,0,0,.42), #000 ${ pct }%)`;
				wavePlayed.style.webkitMaskImage = wavePlayed.style.maskImage;
			}
		}
		if ( seekKnob ) {
			seekKnob.style.transform = `translateX(${ (
				ratio * seekWidth
			).toFixed( 1 ) }px)`;
		}
	};
	// ---- Waveform: where the import measured levels, the seek line becomes the track's shape. Two canvases,
	// base and played, drawn once per track and resize; progress only moves a clip-path on the played copy.
	const waveBase = $( 'wave-base' ),
		waveHover = $( 'wave-hover' ),
		wavePlayed = $( 'wave-played' );
	function drawWave() {
		if ( ! waveBase || ! wavePlayed ) {
			return;
		}
		const lv = queue?.tracks[ i ]?.levels || '';
		const has = lv.length > 1;
		deck.classList.toggle( 'has-wave', has );
		const w = waveBase.parentElement.clientWidth,
			h = waveBase.clientHeight;
		if ( ! has || ! w || ! h ) {
			return;
		}
		const dpr = window.devicePixelRatio || 1,
			css = getComputedStyle( deck ),
			colors = [
				css.getPropertyValue( '--wave' ).trim(),
				css.getPropertyValue( '--wave-hover' ).trim(),
				css.getPropertyValue( '--accent' ).trim(),
			],
			bar = 2,
			gap = 1,
			n = Math.max( 8, Math.floor( ( w + gap ) / ( bar + gap ) ) );
		[ waveBase, waveHover, wavePlayed ].forEach( ( cv, k ) => {
			if ( ! cv ) {
				return;
			}
			cv.width = Math.round( w * dpr );
			cv.height = Math.round( h * dpr );
			const ctx = cv.getContext( '2d' );
			ctx.scale( dpr, dpr );
			ctx.fillStyle = colors[ k ];
			for ( let b = 0; b < n; b++ ) {
				const from = Math.floor( ( b / n ) * lv.length ),
					to = Math.max(
						from + 1,
						Math.floor( ( ( b + 1 ) / n ) * lv.length )
					);
				let peak = 0;
				for ( let x = from; x < to; x++ ) {
					peak = Math.max( peak, +lv[ x ] || 0 );
				}
				// SoundCloud's form: the bar stands on a line two-thirds down, and a fainter reflection hangs below it
				const full = Math.max( 2, ( peak / 9 ) * h ),
					up = Math.max( 1, Math.round( full * 0.64 ) ),
					down = Math.max( 1, Math.round( full * 0.36 ) - 1 ),
					x = b * ( bar + gap ),
					base = Math.round( h * 0.66 );
				ctx.globalAlpha = 1;
				if ( ctx.roundRect ) {
					ctx.beginPath();
					ctx.roundRect( x, base - up, bar, up, 1 );
					ctx.fill();
					ctx.globalAlpha = 0.42;
					ctx.beginPath();
					ctx.roundRect( x, base + 1, bar, down, 1 );
					ctx.fill();
				} else {
					ctx.fillRect( x, base - up, bar, up );
					ctx.globalAlpha = 0.42;
					ctx.fillRect( x, base + 1, bar, down );
				}
			}
		} );
	}
	window.addEventListener( 'resize', drawWave );
	window
		.matchMedia( '(prefers-color-scheme: dark)' )
		.addEventListener( 'change', drawWave );

	// The seek line follows the audio every frame while it plays (compositor transforms only); nothing trails.
	let progressRaf = 0;
	const follow = () => {
		const d = audio.duration || queue?.tracks[ i ]?.duration;
		if ( ! seeking && d ) {
			setProgress( Math.min( playhead() / d, 1 ) );
		}
		if ( looper && ! audio.paused ) {
			paint(); // the element's clock is not the ear's while the looper runs
		}
		progressRaf = audio.paused ? 0 : requestAnimationFrame( follow );
	};
	function paint( force = false ) {
		const now = playhead(),
			d = audio.duration || queue?.tracks[ i ]?.duration,
			sec = Math.floor( now );
		if ( ! seeking && d && ! progressRaf ) {
			setProgress( Math.min( now / d, 1 ) );
		}
		if ( sec === lastSec && ! force ) {
			return;
		}
		lastSec = sec;
		if ( ! seeking ) {
			cur.textContent = fmt( now );
			if ( d ) {
				seek.setAttribute(
					'aria-valuetext',
					`${ fmt( now ) } / ${ fmt( d ) }`
				);
			}
		}
		if ( S.confetti && /^\d+$/.test( S.confetti ) ) {
			cur.classList.toggle(
				'is-lucky',
				sec % 60 === Number( S.confetti ) % 60
			);
		}
		syncLyrics( now );
		syncNotes( now );
	}
	let noteShown = null;
	const fmtDate = ( d ) =>
		d
			? new Date( `${ d }T00:00` ).toLocaleDateString( undefined, {
					month: 'short',
					day: 'numeric',
			  } )
			: '';
	function syncNotes( t, force = false ) {
		const notes = queue?.tracks[ i ]?.notes || [];
		const n = notes.find( ( x ) => t >= x.t && t < x.t + 6 ) || null;
		if ( n === noteShown && ! force ) {
			return;
		}
		noteShown = n;
		nowTitle.classList.toggle( 'is-note', !! n );
		if ( n ) {
			setTitle( n.text, fmtDate( n.date ) );
		} else if ( i >= 0 ) {
			setTitle( queue.tracks[ i ].title );
		}
	}
	function positionState() {
		if (
			! ( 'mediaSession' in navigator ) ||
			! navigator.mediaSession.setPositionState
		) {
			return;
		}
		const d = audio.duration;
		if ( ! isFinite( d ) || ! d ) {
			return;
		}
		try {
			navigator.mediaSession.setPositionState( {
				duration: d,
				playbackRate: audio.playbackRate || 1,
				position: Math.min( playhead(), d ),
			} );
		} catch {}
	}
	function load( n, { play = true, at = 0 } = {} ) {
		if ( ! queue?.tracks.length ) {
			return;
		}
		i = ( n + queue.tracks.length ) % queue.tracks.length;
		const t = queue.tracks[ i ];
		audio.src = t.url;
		setRate( rate, false );
		if ( at ) {
			audio.currentTime = at;
		}
		deck.hidden = false;
		document.body.classList.add( 'has-deck' );
		noteShown = null;
		nowTitle.classList.remove( 'is-note' );
		setTitle( t.title );
		dur.textContent = fmt( t.duration );
		lastSec = -1;
		setProgress( 0 );
		clearLoop();
		countStop();
		paint( true );
		renderSheet( t.id );
		paintMarks( t );
		drawWave();
		syncRows();
		document.dispatchEvent(
			new CustomEvent( 'callboard:track', {
				detail: { set: queue.slug, track: t, index: i },
			} )
		);
		if ( play ) {
			ensureAnalyser();
			const countin = S.count_in && t.bpm && ! at;
			morph( countin ? 'play' : 'pause' );
			if ( countin ) {
				countIn( t.bpm ).then(
					( ok ) => ok && audio.play().catch( () => {} )
				);
			} else {
				audio.play().catch( () => {} );
			}
		}
		if ( 'mediaSession' in navigator ) {
			navigator.mediaSession.metadata = new MediaMetadata( {
				title: t.title,
				artist: queue.name,
				album: G.site,
				artwork: queue.art || [],
			} );
			navigator.mediaSession.setActionHandler( 'previoustrack', prev );
			navigator.mediaSession.setActionHandler( 'nexttrack', () =>
				load( i + 1 )
			);
			navigator.mediaSession.setActionHandler( 'play', () =>
				audio.play().catch( () => {} )
			);
			navigator.mediaSession.setActionHandler( 'pause', () =>
				audio.pause()
			);
			navigator.mediaSession.setActionHandler( 'seekbackward', ( d ) => {
				audio.currentTime = Math.max(
					0,
					audio.currentTime - ( d.seekOffset || 10 )
				);
			} );
			navigator.mediaSession.setActionHandler( 'seekforward', ( d ) => {
				audio.currentTime = Math.min(
					audio.duration || Infinity,
					audio.currentTime + ( d.seekOffset || 10 )
				);
			} );
			try {
				navigator.mediaSession.setActionHandler( 'stop', () => {
					audio.pause();
					audio.currentTime = 0;
				} );
			} catch {}
			try {
				navigator.mediaSession.setActionHandler( 'seekto', ( d ) => {
					audio.currentTime = d.seekTime;
				} );
			} catch {}
		}
		remember();
	}
	function dismissDeck() {
		if ( i < 0 ) {
			return;
		}
		countStop();
		remember();
		audio.pause();
		audio.removeAttribute( 'src' );
		audio.load();
		i = -1;
		queue = null;
		clearLoop();
		eqStop();
		deck.classList.remove( 'playing' );
		deck.hidden = true;
		document.body.classList.remove( 'has-deck' );
		if ( ! lyricsSheet.hidden ) {
			hideLyrics();
		}
		syncRows();
		paintTip();
	}
	let edge = null;
	document.addEventListener( 'pointerdown', ( e ) => {
		if (
			! standalone ||
			e.pointerType === 'mouse' ||
			! view() ||
			e.clientX > 24
		) {
			return;
		}
		edge = {
			x: e.clientX,
			y: e.clientY,
			id: e.pointerId,
			main: $( 'main' ),
		};
		edge.main.style.transition = 'none';
	} );
	document.addEventListener( 'pointermove', ( e ) => {
		if ( ! edge || e.pointerId !== edge.id ) {
			return;
		}
		const dx = e.clientX - edge.x;
		if ( Math.abs( e.clientY - edge.y ) > 60 ) {
			edge.main.style.transform = '';
			edge = null;
			return;
		}
		if ( dx > 0 ) {
			edge.main.style.transform = `translateX(${ dx.toFixed( 0 ) }px)`;
		}
	} );
	const edgeEnd = ( e ) => {
		if ( ! edge || e.pointerId !== edge.id ) {
			return;
		}
		const main = edge.main,
			dx = e.clientX - edge.x;
		edge = null;
		main.style.transition = '';
		if ( dx > Math.min( 120, window.innerWidth / 3 ) ) {
			haptic(); // inside the pointerup, which counts as an activation
			main.animate(
				[
					{ transform: main.style.transform },
					{ transform: 'translateX(100%)' },
				],
				{ duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' }
			).onfinish = () => {
				main.style.transform = '';
				go( G.home, true, false ); // the drag was the transition
			};
			return;
		}
		main.animate(
			[ { transform: main.style.transform }, { transform: 'none' } ],
			{
				duration: 200,
				easing: 'cubic-bezier(.34,1.4,.64,1)',
			}
		).onfinish = () => {
			main.style.transform = '';
		};
	};
	document.addEventListener( 'pointerup', edgeEnd );
	document.addEventListener( 'pointercancel', edgeEnd );
	const deckRow = deck.querySelector( '.deck-row' );
	let swipe = null;
	deckRow?.addEventListener( 'pointerdown', ( e ) => {
		if ( e.pointerType === 'mouse' || e.target.closest( 'button' ) ) {
			return;
		}
		swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
	} );
	deckRow?.addEventListener( 'pointermove', ( e ) => {
		if ( ! swipe || e.pointerId !== swipe.id ) {
			return;
		}
		const dy = e.clientY - swipe.y;
		if ( dy > 0 && Math.abs( e.clientX - swipe.x ) < 40 ) {
			deck.style.transform = `translateY(${ Math.min( dy, 120 ).toFixed(
				0
			) }px)`;
		}
	} );
	const swipeEnd = ( e ) => {
		if ( ! swipe || e.pointerId !== swipe.id ) {
			return;
		}
		const dy = e.clientY - swipe.y,
			dx = Math.abs( e.clientX - swipe.x );
		swipe = null;
		if ( dy > 70 && dx < 40 ) {
			haptic();
			const slide = deck.animate(
				[
					{ transform: deck.style.transform },
					{ transform: 'translateY(100%)' },
				],
				{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }
			);
			slide.onfinish = () => {
				deck.style.transform = '';
				dismissDeck();
			};
			return;
		}
		deck.animate(
			[ { transform: deck.style.transform }, { transform: 'none' } ],
			{
				duration: 200,
				easing: 'cubic-bezier(.34,1.4,.64,1)',
			}
		).onfinish = () => {
			deck.style.transform = '';
		};
	};
	deckRow?.addEventListener( 'pointerup', swipeEnd );
	deckRow?.addEventListener( 'pointercancel', swipeEnd );

	function prev() {
		if ( i < 0 ) {
			return load( 0 );
		}
		if ( audio.currentTime > 3 ) {
			audio.currentTime = 0;
		} else {
			load( i - 1 );
		}
	}
	function startSet( set, n, opts ) {
		if ( queue?.slug !== set.slug ) {
			queue = set;
		}
		load( n, opts );
	}

	$( 'prev' ).addEventListener( 'click', () => {
		haptic();
		retrigger( $( 'prev' ), 'kick-l' );
		prev();
	} );
	$( 'next' ).addEventListener( 'click', () => {
		haptic();
		retrigger( $( 'next' ), 'kick-r' );
		load( i < 0 ? 0 : i + 1 );
	} );
	toggle.addEventListener( 'click', () => {
		haptic();
		if ( countStop() ) {
			morph( 'pause' );
			return audio.play().catch( () => {} );
		}
		if ( i >= 0 ) {
			morph( audio.paused ? 'pause' : 'play' ); // answer the tap now; the audio events reconcile
		}
		if ( i < 0 ) {
			return load( 0 );
		}
		return audio.paused ? audio.play().catch( () => {} ) : audio.pause();
	} );

	// ---- Count-in: with a tempo, Play from the top taps four beats first (a soft click, the button breathes)
	let countCancel = null,
		clickCtx = null;
	const click = ( first ) => {
		try {
			clickCtx =
				clickCtx ||
				new ( window.AudioContext || window.webkitAudioContext )();
			const o = clickCtx.createOscillator(),
				g = clickCtx.createGain(),
				at = clickCtx.currentTime;
			o.frequency.value = first ? 1320 : 880;
			g.gain.setValueAtTime( 0.0001, at );
			g.gain.exponentialRampToValueAtTime( 0.18, at + 0.006 );
			g.gain.exponentialRampToValueAtTime( 0.0001, at + 0.07 );
			o.connect( g ).connect( clickCtx.destination );
			o.start( at );
			o.stop( at + 0.08 );
		} catch {}
	};
	function countStop() {
		if ( ! countCancel ) {
			return false;
		}
		countCancel();
		countCancel = null;
		return true;
	}
	function countIn( bpm ) {
		countStop();
		const beat = 60000 / bpm / rate; // the count-in keeps time with the slowed track
		return new Promise( ( resolve ) => {
			const timers = [];
			deck.classList.add( 'counting' );
			nowTitle.classList.add( 'is-count' );
			const done = ( ok ) => {
				timers.forEach( clearTimeout );
				deck.classList.remove( 'counting' );
				nowTitle.classList.remove( 'is-count' );
				countCancel = null;
				if ( i >= 0 ) {
					setTitle( queue.tracks[ i ].title );
				}
				resolve( ok );
			};
			countCancel = () => done( false );
			for ( let k = 1; k <= 4; k++ ) {
				timers.push(
					setTimeout(
						() => {
							setTitle(
								Array.from(
									{ length: k },
									( _, n ) => n + 1
								).join( '   ' )
							); // the count accumulates: 1, 1 2, 1 2 3, 1 2 3 4
							click( k === 1 ); // the beat is audible only: a timer is not a gesture, so no haptic can ride on it
							if ( ! reduce() ) {
								retrigger( toggle, 'beat' );
							}
						},
						( k - 1 ) * beat
					)
				);
			}
			timers.push( setTimeout( () => done( true ), 4 * beat ) );
		} );
	}
	// Play or pause: a state on the button; the stylesheet slides the glyph's points between the two shapes.
	const morph = ( to ) => {
		if ( toggle.dataset.state === to ) {
			return;
		}
		toggle.dataset.state = to;
		toggle.setAttribute(
			'aria-label',
			to === 'pause' ? T.pause : T.resume
		);
	};
	// ---- One player per site. Playing takes a lock; a tab that starts playing steals it and the loser pauses.
	// A new track in this same tab also steals from its own earlier request, so a request only pauses the
	// element when it is still the latest one: that is a theft by another tab, not by ourselves.
	let releaseLock = null,
		lockTicket = 0;
	audio.addEventListener( 'play', () => {
		if ( ! navigator.locks ) {
			return;
		}
		const ticket = ++lockTicket;
		navigator.locks
			.request(
				'callboard:player',
				{ steal: true },
				() => new Promise( ( done ) => ( releaseLock = done ) )
			)
			.catch( () => {
				if ( ticket === lockTicket ) {
					releaseLock = null;
					audio.pause(); // stolen by another tab: it is the player now
				}
			} );
	} );
	audio.addEventListener( 'pause', () => {
		releaseLock?.();
		releaseLock = null;
		looperStop();
	} );
	audio.addEventListener( 'play', () => {
		if ( loop ) {
			looperStart();
		}
	} );
	audio.addEventListener( 'play', () => {
		played = true;
		cancelAnimationFrame( progressRaf );
		follow();
		morph( 'pause' );
		deck.classList.add( 'playing' );
		syncRows();
		retrigger( toggle, 'ring' );
		positionState();
	} );
	audio.addEventListener( 'pause', () => {
		morph( 'play' );
		deck.classList.remove( 'playing', 'buffering' );
		syncRows();
		remember();
		positionState();
		paint( true );
	} );
	audio.addEventListener( 'waiting', () =>
		deck.classList.add( 'buffering' )
	);
	audio.addEventListener( 'playing', () =>
		deck.classList.remove( 'buffering' )
	);
	audio.addEventListener( 'canplay', () =>
		deck.classList.remove( 'buffering' )
	);
	audio.addEventListener( 'ended', () => load( i + 1 ) );
	audio.addEventListener( 'loadedmetadata', () => {
		if ( isFinite( audio.duration ) ) {
			dur.textContent = fmt( audio.duration );
		}
		positionState();
	} );
	audio.addEventListener( 'timeupdate', () => {
		if ( audio.currentTime > 0 ) {
			deck.classList.remove( 'buffering' );
		}
		if ( loop && audio.currentTime >= loop.b ) {
			audio.currentTime = loop.a;
		}
		paint();
		if ( ( audio.currentTime | 0 ) % 5 === 0 ) {
			remember();
			positionState();
		}
	} );
	audio.addEventListener( 'seeked', () => {
		paint( true );
		positionState();
	} );
	// ---- Remote playback: AirPlay in Safari, Cast in Chrome. The chip shows while a device is in reach and
	// the picker is the browser's own. Safari has no availability watcher for audio; there the chip stays
	// and the picker says what it finds.
	const remoteBtn = $( 'remote' );
	if ( remoteBtn && audio.remote ) {
		const paintRemote = () => {
			const state = audio.remote.state || 'disconnected';
			remoteBtn.dataset.state = state === 'disconnected' ? '' : state;
			deck.classList.toggle( 'remote', state !== 'disconnected' );
			remoteBtn.setAttribute(
				'aria-label',
				state === 'disconnected' ? T.remote : T.remote_on
			);
		};
		audio.remote
			.watchAvailability( ( ok ) => {
				remoteBtn.classList.toggle( 'is-away', ! ok ); // hides in its slot; the row never shifts
			} )
			.catch( () => {
				remoteBtn.classList.remove( 'is-away' );
			} );
		[ 'connecting', 'connect', 'disconnect' ].forEach( ( ev ) =>
			audio.remote.addEventListener( ev, paintRemote )
		);
		remoteBtn.addEventListener( 'click', () => {
			haptic();
			audio.remote.prompt().catch( () => {} ); // cancelled, or nothing in reach: the picker already said so
		} );
	}

	// Safari restores pages from the back/forward cache with their script state frozen mid-thought. On a
	// restore, the deck reads the element again rather than trusting what it last drew.
	window.addEventListener( 'pageshow', ( e ) => {
		if ( e.persisted ) {
			morph( audio.paused ? 'play' : 'pause' );
			positionState();
		}
	} );

	// The deck's height is a token the page padding and the lyrics sheet read. Measured rather than assumed,
	// so Dynamic Type on iPhone, a landscape inset, or a longer row never leaves the last track under the deck.
	if ( window.ResizeObserver ) {
		new ResizeObserver( () => {
			if ( deck.hidden ) {
				return;
			}
			const h =
				deck.offsetHeight -
				parseFloat( getComputedStyle( deck ).paddingBottom ); // the overscroll run-off and the safe area are not height
			if ( h > 80 ) {
				document.documentElement.style.setProperty(
					'--deck-h',
					`${ Math.round( h ) }px`
				);
			}
		} ).observe( deck );
	}

	// ---- Marks on the seek line: ticks where singing resumes after a rest (from the lyrics), pins for director notes
	const marks = $( 'seek-marks' );
	let ticks = [];
	function paintMarks( t ) {
		if ( ! marks ) {
			return;
		}
		marks.innerHTML = '';
		ticks = [];
		const d = t.duration || 0;
		if ( ! d ) {
			return;
		}
		const cuesFor = ( queue?.lyrics && queue.lyrics[ t.id ] ) || [];
		let prevEnd = -10;
		cuesFor.forEach( ( [ s, e ] ) => {
			if (
				s - prevEnd >= 3 &&
				s > 1.5 &&
				s < d - 1.5 &&
				ticks.length < 40
			) {
				ticks.push( s );
			}
			prevEnd = e;
		} );
		( t.notes || [] ).forEach( ( n ) => ticks.push( n.t ) );
		ticks.forEach( ( at ) => {
			const el = document.createElement( 'i' );
			el.className = 'tick';
			el.style.left = `${ ( ( at / d ) * 100 ).toFixed( 2 ) }%`;
			marks.appendChild( el );
		} );
		( t.notes || [] ).forEach( ( n ) => {
			const el = document.createElement( 'i' );
			el.className = 'pin';
			el.dataset.t = n.t;
			el.style.left = `${ ( ( n.t / d ) * 100 ).toFixed( 2 ) }%`;
			marks.appendChild( el );
		} );
	}
	marks?.addEventListener( 'click', ( e ) => {
		const pin = e.target.closest( '.pin' );
		if ( ! pin ) {
			return;
		}
		audio.currentTime = +pin.dataset.t;
		audio.play().catch( () => {} );
	} );
	const settle = ( t, d ) => {
		const near = ticks.find( ( x ) => Math.abs( x - t ) < d * 0.02 );
		if ( near !== undefined && near !== t ) {
			haptic();
		}
		return near === undefined ? t : near;
	};

	// ---- A-B loop: hold two fingers on the seek line; on a keyboard [ and ] set the ends, \ clears
	let loop = null,
		loopGesture = false;
	// ---- Gapless loop. Resetting currentTime leaves a seam at the join; an AudioBufferSourceNode loops
	// sample-accurately. It runs only while the page is visible and at full speed (Web Audio has no
	// preservesPitch). The element keeps playing muted underneath, so the media session, lock-screen controls
	// and background play are exactly what they were; when the tab hides, the speed changes or the loop
	// clears, the element takes the sound back at the looper's position.
	const canLoopGapless = () =>
		'AudioContext' in window &&
		rate === 1 &&
		document.visibilityState === 'visible';
	const playhead = () => {
		if ( ! looper || ! loop ) {
			return audio.currentTime;
		}
		const len = loop.b - loop.a,
			t =
				looper.offset -
				loop.a +
				( looper.ctx.currentTime - looper.startedAt );
		return loop.a + ( ( ( t % len ) + len ) % len );
	};
	async function looperStart() {
		if ( ! loop || looper || ! canLoopGapless() || audio.paused ) {
			return;
		}
		const url = audio.currentSrc || audio.src;
		const ticket = { pending: true };
		looper = ticket;
		try {
			looperCtx = looperCtx || new AudioContext();
			if ( looperCtx.state === 'suspended' ) {
				await looperCtx.resume();
			}
			if ( looperBuf?.url !== url ) {
				const bytes = await ( await fetch( url ) ).arrayBuffer();
				looperBuf = {
					url,
					buffer: await looperCtx.decodeAudioData( bytes ),
				};
			}
		} catch {
			looper = null; // no decode here: the element's own loop stands
			return;
		}
		if (
			looper !== ticket ||
			! loop ||
			audio.paused ||
			! canLoopGapless() ||
			looperCtx.state !== 'running' // autoplay policy kept the context shut: never mute the element for a silent looper
		) {
			looper = null;
			return;
		}
		const src = looperCtx.createBufferSource();
		src.buffer = looperBuf.buffer;
		src.loop = true;
		src.loopStart = loop.a;
		src.loopEnd = Math.min( loop.b, looperBuf.buffer.duration );
		src.connect( analyser || looperCtx.destination );
		const from = Math.min(
			Math.max( audio.currentTime, loop.a ),
			src.loopEnd - 0.05
		);
		src.start( 0, from );
		audio.muted = true;
		looper = {
			ctx: looperCtx,
			src,
			startedAt: looperCtx.currentTime,
			offset: from,
		};
	}
	function looperStop() {
		if ( ! looper ) {
			return;
		}
		const pos = looper.src ? playhead() : null;
		try {
			looper.src?.stop();
		} catch {}
		looper = null;
		audio.muted = false;
		if ( pos !== null && loop ) {
			audio.currentTime = pos; // the element picks up where the ear left off
		}
	}
	document.addEventListener( 'visibilitychange', () => {
		if ( document.visibilityState === 'visible' ) {
			looperStart();
		} else {
			looperStop();
		}
	} );
	const loopBand = $( 'loop-band' ),
		loopChip = $( 'loop' );
	const trackDur = () => audio.duration || queue?.tracks[ i ]?.duration || 0;
	function setLoop( a, b ) {
		const d = trackDur();
		a = Math.max( 0, a );
		b = Math.min( d || b, b );
		if ( ! d || b - a < 1 ) {
			return;
		}
		loop = { a, b };
		haptic();
		loopBand.style.transform = `translateX(${ ( ( a / d ) * 100 ).toFixed(
			2
		) }%) scaleX(${ ( ( b - a ) / d ).toFixed( 4 ) })`;
		loopBand.classList.add( 'on' );
		loopChip.dataset.state = 'on';
		requestAnimationFrame( () => syncNotes( audio.currentTime, true ) );
		loopChip.setAttribute(
			'aria-label',
			`${ T.loop_clear }: ${ fmt( a ) }–${ fmt( b ) }`
		);
		if ( audio.currentTime < a || audio.currentTime > b ) {
			audio.currentTime = a;
		}
		looperStop();
		audio.play().catch( () => {} );
		looperStart();
		keepAwake(); // a loop means the phone is on the stand
	}
	let loopFrom = null;
	function clearLoop() {
		if ( loop ) {
			haptic();
		}
		looperStop();
		if ( lyricsSheet.hidden ) {
			letSleep();
		}
		loop = null;
		loopFrom = null;
		if ( loopBand ) {
			loopBand.classList.remove( 'on' );
			loopChip.dataset.state = '';
			loopChip.setAttribute( 'aria-label', T.loop_set );
			requestAnimationFrame( () => syncNotes( audio.currentTime, true ) );
		}
	}
	// One control, three taps: mark the start, mark the end, clear. Two fingers on the line or [ ] do the same.
	loopChip?.addEventListener( 'click', () => {
		if ( loop ) {
			return clearLoop();
		}
		if ( loopFrom === null ) {
			haptic();
			loopFrom = audio.currentTime;
			loopChip.dataset.state = 'armed';
			loopChip.setAttribute(
				'aria-label',
				`${ T.loop_from } ${ fmt( loopFrom ) } · ${ T.loop_end }`
			);
			return;
		}
		const a = Math.min( loopFrom, audio.currentTime ),
			b = Math.max( loopFrom, audio.currentTime );
		loopFrom = null;
		if ( b - a < 1 ) {
			return clearLoop(); // the same spot twice: nothing to loop
		}
		setLoop( a, b );
	} );
	const seekWrap = document.querySelector( '.seek-wrap' ),
		pointers = new Map();
	let loopHold = 0;
	seekWrap?.addEventListener(
		'pointerdown',
		( e ) => {
			pointers.set( e.pointerId, e.clientX );
			if ( pointers.size === 2 ) {
				clearTimeout( loopHold );
				loopHold = setTimeout( () => {
					const rect = seek.getBoundingClientRect(),
						d = trackDur();
					const r = ( x ) =>
						Math.min(
							1,
							Math.max( 0, ( x - rect.left ) / rect.width )
						);
					const xs = [ ...pointers.values() ].map( r );
					loopGesture = true;
					seeking = false;
					deck.classList.remove( 'seeking' );
					setLoop( Math.min( ...xs ) * d, Math.max( ...xs ) * d );
				}, 300 );
			}
		},
		true
	);
	const lift = ( e ) => {
		pointers.delete( e.pointerId );
		if ( pointers.size < 2 ) {
			clearTimeout( loopHold );
		}
		if ( ! pointers.size ) {
			setTimeout( () => {
				loopGesture = false;
			}, 50 );
		}
	};
	seekWrap?.addEventListener( 'pointermove', ( e ) => {
		// the hover preview follows the pointer; a CSS variable, so no repaint of the bars
		const r = seekWrap.getBoundingClientRect();
		seekWrap.style.setProperty(
			'--hx',
			`${ Math.min(
				100,
				Math.max( 0, ( ( e.clientX - r.left ) / r.width ) * 100 )
			).toFixed( 2 ) }%`
		);
	} );
	seekWrap?.addEventListener( 'pointerup', lift, true );
	seekWrap?.addEventListener( 'pointercancel', lift, true );

	seek.addEventListener( 'input', () => {
		if ( loopGesture || pointers.size > 1 ) {
			return;
		}
		seeking = true;
		deck.classList.add( 'seeking' );
		const d = audio.duration || queue?.tracks[ i ]?.duration || 0,
			r = seek.value / 1000;
		setProgress( r );
		cur.textContent = fmt( r * d );
		seek.setAttribute(
			'aria-valuetext',
			`${ fmt( r * d ) } / ${ fmt( d ) }`
		);
	} );
	seek.addEventListener( 'change', () => {
		const d = audio.duration || queue?.tracks[ i ]?.duration;
		if ( loopGesture ) {
			paint( true );
			return;
		}
		if ( d ) {
			audio.currentTime = settle( ( seek.value / 1000 ) * d, d );
		}
		seeking = false;
		deck.classList.remove( 'seeking' );
		paint( true );
	} );
	seek.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'ArrowLeft' || e.key === 'ArrowRight' ) {
			e.preventDefault();
			audio.currentTime += e.key === 'ArrowRight' ? 5 : -5;
		}
	} );
	document.addEventListener( 'keydown', ( e ) => {
		if ( e.target.matches( 'input,select,textarea' ) ) {
			return;
		}
		if ( e.key === ' ' ) {
			e.preventDefault();
			toggle.click();
		} else if ( e.key === 'ArrowRight' && e.shiftKey ) {
			load( i + 1 );
		} else if ( e.key === 'ArrowLeft' && e.shiftKey ) {
			prev();
		} else if ( e.key === 'ArrowRight' ) {
			audio.currentTime += 5;
		} else if ( e.key === 'ArrowLeft' ) {
			audio.currentTime -= 5;
		} else if ( e.key === '[' ) {
			setLoop( audio.currentTime, loop ? loop.b : trackDur() );
		} else if ( e.key === ']' ) {
			setLoop( loop ? loop.a : 0, audio.currentTime );
		} else if ( e.key === '\\' ) {
			clearLoop();
		} else if ( e.key === ',' ) {
			stepRate( 1 );
		} else if ( e.key === '.' ) {
			stepRate( -1 );
		} else if ( e.key === 'Escape' && ! lyricsSheet.hidden ) {
			hideLyrics();
		} else if ( e.key === 'Escape' && audio.paused && i >= 0 ) {
			dismissDeck();
		}
	} );

	// ---- Lyrics (only where a set has approved lyrics); otherwise the deck title finds the playing track.
	// The cues also live on the media element as a metadata text track, so the browser fires cuechange for
	// them, on time even when the tab is throttled, and a seek lands on the right line without a scan.
	let sheetKind = '';
	const lyricTrack =
		'VTTCue' in window && audio.addTextTrack
			? audio.addTextTrack( 'metadata', 'Lyrics' )
			: null;
	if ( lyricTrack ) {
		lyricTrack.mode = 'hidden';
		lyricTrack.addEventListener( 'cuechange', () => {
			const active = lyricTrack.activeCues;
			if ( active && active.length ) {
				markCue( Number( active[ active.length - 1 ].id ) );
			}
		} );
	}
	function loadCues() {
		if ( ! lyricTrack ) {
			return;
		}
		Array.from( lyricTrack.cues || [] ).forEach( ( c ) =>
			lyricTrack.removeCue( c )
		);
		// each cue runs until the next begins, so exactly one is active and the last line holds to the end
		cues.forEach( ( [ start, , text ], k ) => {
			const end =
				k + 1 < cues.length
					? cues[ k + 1 ][ 0 ]
					: trackDur() || start + 3600;
			if ( end > start ) {
				const cue = new VTTCue( start, end, text );
				cue.id = String( k );
				lyricTrack.addCue( cue );
			}
		} );
	}
	function renderSheet( id ) {
		cues = ( queue?.lyrics && queue.lyrics[ id ] ) || [];
		const notes = queue?.tracks[ i ]?.notes || [];
		cueIdx = -1;
		lyricsList.innerHTML = '';
		sheetKind = cues.length ? 'lyrics' : notes.length ? 'notes' : '';
		if ( sheetKind ) {
			openLyrics.dataset.sheet =
				sheetKind === 'lyrics' ? T.lyrics_label : T.notes;
		} else {
			delete openLyrics.dataset.sheet;
		}
		openLyrics.dataset.line = openLyrics.dataset.sheet || queue?.name || ''; // the line under the title is never blank
		openLyrics.setAttribute(
			'aria-label',
			sheetKind === 'lyrics'
				? T.show_lyrics
				: sheetKind
				? T.show_notes
				: T.show_track
		);
		$( 'sheet-label' ).textContent =
			sheetKind === 'notes' ? T.notes_sheet : T.lyrics_sheet;
		const item = ( at, text, detail ) => {
			const li = document.createElement( 'li' );
			if ( detail !== undefined ) {
				const time = document.createElement( 'time' );
				time.textContent = fmt( at );
				li.appendChild( time );
			}
			li.appendChild( document.createTextNode( text ) );
			if ( detail ) {
				const d = document.createElement( 'small' );
				d.textContent = detail;
				li.appendChild( d );
			}
			li.tabIndex = 0;
			li.addEventListener( 'click', () => {
				audio.currentTime = at;
				audio.play().catch( () => {} );
			} );
			lyricsList.appendChild( li );
			return li;
		};
		cueEls = cues.length
			? cues.map( ( [ s, , text ] ) => item( s, text ) )
			: notes.map( ( n ) => item( n.t, n.text, fmtDate( n.date ) ) );
		loadCues();
	}
	function syncLyrics( t ) {
		if ( ! cues.length ) {
			return;
		}
		let n = -1;
		for ( let k = 0; k < cues.length; k++ ) {
			if ( t >= cues[ k ][ 0 ] ) {
				n = k;
			} else {
				break;
			}
		}
		markCue( n );
	}
	function markCue( n ) {
		if ( n === cueIdx ) {
			return;
		}
		cueIdx = n;
		cueEls.forEach( ( el, k ) => {
			el.classList.toggle( 'now', k === n );
			el.classList.toggle( 'past', k < n );
		} );
		if ( n >= 0 && ! lyricsSheet.hidden ) {
			cueEls[ n ].scrollIntoView( {
				block: 'center',
				behavior: 'smooth',
			} );
		}
	}
	let wake = null;
	const keepAwake = async () => {
		try {
			wake = await navigator.wakeLock?.request( 'screen' );
		} catch {}
	};
	const letSleep = () => {
		wake?.release().catch( () => {} );
		wake = null;
	};
	document.addEventListener( 'visibilitychange', () => {
		if ( document.visibilityState === 'visible' && ! lyricsSheet.hidden ) {
			keepAwake();
		}
	} );
	let sheetTimer = 0;
	function showLyrics() {
		keepAwake();
		clearTimeout( sheetTimer );
		lyricsSheet.classList.remove( 'closing' );
		lyricsSheet.hidden = false;
		document.body.classList.add( 'sheet-open' );
		openLyrics.setAttribute( 'aria-expanded', 'true' );
		openLyrics.setAttribute(
			'aria-label',
			sheetKind === 'notes' ? T.hide_notes : T.hide_lyrics
		);
		if ( cueIdx >= 0 ) {
			cueEls[ cueIdx ].scrollIntoView( { block: 'center' } );
		}
		$( 'close-lyrics' ).focus();
	}
	function hideLyrics() {
		letSleep();
		document.body.classList.remove( 'sheet-open' );
		if ( reduce() || lyricsSheet.hidden ) {
			lyricsSheet.hidden = true;
		} else {
			lyricsSheet.classList.add( 'closing' ); // slides away, then leaves the tree
			clearTimeout( sheetTimer );
			sheetTimer = setTimeout( () => {
				lyricsSheet.hidden = true;
				lyricsSheet.classList.remove( 'closing' );
			}, 320 );
		}
		openLyrics.setAttribute( 'aria-expanded', 'false' );
		openLyrics.setAttribute(
			'aria-label',
			sheetKind === 'notes' ? T.show_notes : T.show_lyrics
		);
		openLyrics.focus();
	}
	openLyrics.addEventListener( 'click', () => {
		if ( i < 0 ) {
			return;
		}
		haptic();
		if ( sheetKind ) {
			return lyricsSheet.hidden ? showLyrics() : hideLyrics();
		}
		if ( ! onQueuePage() ) {
			return go( `${ G.home }${ queue.slug }/` );
		}
		rows[ i ]?.scrollIntoView( { block: 'center', behavior: 'smooth' } );
		rows[ i ]?.focus( { preventScroll: true } );
	} );
	$( 'close-lyrics' ).addEventListener( 'click', () => {
		haptic();
		hideLyrics();
	} );

	document
		.querySelector( '.skip-link' )
		?.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			const m = $( 'main' );
			m.focus();
			requestAnimationFrame( () => {
				if ( document.activeElement !== m ) {
					m.focus(); // a late layout pass can drop the first attempt
				}
			} );
		} );

	// ---- Delegated clicks: track rows and in-app links
	document.addEventListener( 'click', ( e ) => {
		const r = e.target.closest( '.track' );
		if ( r ) {
			const set = setBy( view() ),
				n = +r.dataset.i;
			if ( ! set ) {
				return;
			}
			haptic();
			if ( onQueuePage() && n === i ) {
				if ( audio.paused ) {
					audio.play().catch( () => {} );
				} else {
					audio.pause();
				}
			} else {
				startSet( set, n );
			}
			return;
		}
		const a = e.target.closest( 'a[href]' );
		if (
			! a ||
			a.target === '_blank' ||
			a.origin !== location.origin ||
			e.metaKey ||
			e.ctrlKey ||
			e.shiftKey
		) {
			return;
		}
		if ( a.hash && a.pathname === location.pathname ) {
			return; // a fragment on this page (the skip link): the browser handles it
		}
		if ( routeOf( a.href ) === null ) {
			return;
		}
		e.preventDefault();
		go( a.href );
	} );

	// ---- Install card: one element. iOS gets the two Safari steps, Chromium gets a one-tap prompt,
	// in-app browsers get a way out to Safari. Never shown once installed or dismissed.
	const tip = $( 'a2hs' ),
		tipText = $( 'a2hs-text' ),
		tipGo = $( 'a2hs-go' );
	const tipDefault = tipText ? tipText.innerHTML : '';
	function paintTip() {
		if ( ! tip ) {
			return;
		}
		const wanted =
			S.hint &&
			! standalone &&
			! ls.get( 'callboard:a2hs' ) &&
			( isIOS || installPrompt );
		tip.hidden = ! wanted;
		if ( ! wanted ) {
			return;
		}
		if ( inApp ) {
			tipText.textContent = T.open_safari;
			tipGo.textContent = T.open_safari_go;
			tipGo.hidden = false;
			tipGo.onclick = () => {
				location.href = `x-safari-${ location.href }`;
			};
		} else if ( installPrompt ) {
			tipText.textContent = T.install;
			tipGo.textContent = T.install_go;
			tipGo.hidden = false;
			tipGo.onclick = async () => {
				const p = installPrompt;
				installPrompt = null;
				try {
					await p.prompt();
				} catch {}
				paintTip();
			};
		} else {
			tipText.innerHTML = tipDefault;
			tipGo.hidden = true;
		}
	}
	$( 'a2hs-close' )?.addEventListener( 'click', () => {
		ls.set( 'callboard:a2hs', 1 );
		paintTip();
	} );

	// ---- Online / offline
	const paintNet = () => {
		document.body.classList.toggle( 'is-offline', ! navigator.onLine );
		const b = $( 'offline' );
		if ( b && ! b.classList.contains( 'is-busy' ) ) {
			b.disabled =
				! navigator.onLine && ! b.classList.contains( 'is-done' );
		}
	};
	window.addEventListener( 'online', paintNet );
	window.addEventListener( 'offline', paintNet );
	paintNet();

	// ---- Notifications (Web Push) and the app badge
	if ( 'clearAppBadge' in navigator ) {
		navigator.clearAppBadge().catch( () => {} );
	}
	const urlBase64ToUint8Array = ( b64 ) => {
		const s = ( b64 + '='.repeat( ( 4 - ( b64.length % 4 ) ) % 4 ) )
			.replace( /-/g, '+' )
			.replace( /_/g, '/' );
		const raw = atob( s );
		return Uint8Array.from( [ ...raw ].map( ( c ) => c.charCodeAt( 0 ) ) );
	};
	const toastEl = $( 'toast' );
	let toastTimer = 0;
	function toast( msg ) {
		if ( ! toastEl ) {
			return;
		}
		toastEl.textContent = msg;
		toastEl.hidden = false;
		clearTimeout( toastTimer );
		toastTimer = setTimeout( () => {
			toastEl.hidden = true;
		}, 4000 );
	}
	async function bindNotify() {
		const btn = $( 'notify' );
		if ( ! btn ) {
			return;
		}
		const iosTab = isIOS && ! standalone; // Safari's tab: push needs the Home Screen app; the bell explains
		if (
			! iosTab &&
			( ! G.push ||
				! ( 'serviceWorker' in navigator ) ||
				! ( 'PushManager' in window ) ||
				! ( 'Notification' in window ) )
		) {
			btn.hidden = true; // no push in this browser at all: the one case the bell leaves
			return;
		}
		const reg = iosTab ? null : await navigator.serviceWorker.ready;
		let sub = reg ? await reg.pushManager.getSubscription() : null;
		const paintBell = () => {
			btn.dataset.state = sub ? 'on' : '';
			btn.setAttribute( 'aria-pressed', sub ? 'true' : 'false' );
			btn.setAttribute( 'aria-label', sub ? T.notify_on : T.notify );
		};
		paintBell();
		btn.onclick = async () => {
			haptic(); // now, while this is still the tap; nothing after the awaits below can
			if ( iosTab ) {
				return toast( T.notify_home );
			}
			if ( Notification.permission === 'denied' ) {
				return toast( T.notify_denied );
			}
			btn.disabled = true;
			try {
				if ( sub ) {
					await fetch( `${ G.push.api }unsubscribe`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify( { endpoint: sub.endpoint } ),
					} );
					await sub.unsubscribe();
					sub = null;
				} else if (
					( await Notification.requestPermission() ) !== 'granted'
				) {
					toast( T.notify_denied );
				} else {
					sub = await reg.pushManager.subscribe( {
						userVisibleOnly: true,
						applicationServerKey: urlBase64ToUint8Array(
							G.push.key
						),
					} );
					const r = await fetch( `${ G.push.api }subscribe`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify( sub.toJSON() ),
					} );
					if ( ! r.ok ) {
						await sub.unsubscribe();
						sub = null;
					} else {
						toast( T.notify_on );
					}
				}
			} catch {}
			btn.disabled = false;
			paintBell();
		};
	}

	// Home rows: where each set was left, and which one is in the deck. Text inside the meta line, so nothing moves.
	function paintHomeResume() {
		document.querySelectorAll( '.set-resume' ).forEach( ( el ) => {
			const s = setBy( el.dataset.slug ),
				pos = s && ls.get( `callboard:${ s.slug }` ),
				t = pos && s.tracks[ pos.i ];
			el.closest( '.set' )?.classList.toggle(
				'is-now',
				!! queue && queue.slug === s?.slug
			);
			el.textContent =
				t && ( pos.i > 0 || pos.t >= 15 )
					? ` · ${ tpl( T.left_off, t.title ) }`
					: '';
		} );
	}

	// ---- Per-view bindings (first load and after every render)
	let homeOffTimer = 0;
	async function paintHomeOffline() {
		clearTimeout( homeOffTimer );
		if ( ! ( 'caches' in window ) || view() ) {
			return;
		}
		let busy = false;
		for ( const s of G.sets ) {
			const el = document.querySelector(
				`.set-off[data-slug="${ s.slug }"]`
			);
			if ( ! el || ! s.tracks.length ) {
				continue;
			}
			const have = ( await savedSet( s.tracks ) ).size,
				saving = s.tracks.some( ( t ) => dlAborts.has( t.url ) );
			busy = busy || saving;
			const state = saving
				? 'saving'
				: have === s.tracks.length
				? 'saved'
				: have
				? 'partial'
				: '';
			el.dataset.state = state;
			if ( state === 'saved' ) {
				warmPage( s.slug );
			}
			if ( state ) {
				el.style.setProperty(
					'--p',
					( have / s.tracks.length ).toFixed( 3 )
				);
			}
			el.setAttribute(
				'aria-label',
				state === 'saved'
					? T.saved
					: state
					? tpl( T.saving_set, have, s.tracks.length )
					: ''
			);
		}
		if ( busy ) {
			homeOffTimer = setTimeout( paintHomeOffline, 800 );
		}
	}
	function bindView() {
		const set = setBy( view() );
		$( 'topbar-title' ).textContent = set ? set.name : G.site;
		if ( ! set ) {
			bindNotify().catch( () => {} );
			paintHomeOffline().catch( () => {} );
			paintHomeResume();
		}
		if ( set?.tracks.length ) {
			if ( ! queue ) {
				queue = set;
				const saved = ls.get( key() );
				load( saved && set.tracks[ saved.i ] ? saved.i : 0, {
					play: false,
					at: saved?.t || 0,
				} );
			}
			$( 'play-all' )?.addEventListener( 'click', () => {
				haptic();
				if ( played && onQueuePage() && i >= 0 ) {
					if ( audio.paused ) {
						audio.play().catch( () => {} );
					} else {
						audio.pause();
					}
				} else {
					startSet( set, 0 );
				}
			} );
			setTimeout( () => bindOffline( set ), 700 );
		}
		bindShare( set );
		paintTip();
		syncRows();
		document.dispatchEvent(
			new CustomEvent( 'callboard:view', {
				detail: { set: set?.slug || '' },
			} )
		);
	}
	// ---- Share: the system sheet where there is one (iPhone, Android, Windows), the clipboard elsewhere.
	// The link alone is enough; the set's share card rides along as its Open Graph image.
	function bindShare( set ) {
		const btn = $( 'share' );
		if ( ! btn || ! set ) {
			return;
		}
		if ( ! ( navigator.share || navigator.clipboard?.writeText ) ) {
			btn.hidden = true; // nowhere to send a link: the one case the button leaves
			return;
		}
		btn.addEventListener( 'click', () => {
			haptic();
			const url = `${ G.home }${ set.slug }/`;
			if ( navigator.share ) {
				navigator
					.share( {
						title: `${ set.name } · ${ G.site }`,
						text: set.meta,
						url,
					} )
					.catch( () => {} ); // the sheet was dismissed
				return;
			}
			navigator.clipboard
				.writeText( url )
				.then( () => {
					const icon = btn.innerHTML;
					btn.textContent = T.copied;
					btn.classList.add( 'is-done' );
					setTimeout( () => {
						btn.innerHTML = icon;
						btn.classList.remove( 'is-done' );
					}, 1600 );
				} )
				.catch( () => {} );
		} );
	}

	// ---- Offline, per track. Each row has its own control; the set button drives them all.
	const CACHE = 'callboard-audio-v1';
	const dlAborts = new Map();
	const norm = ( u ) => new URL( u, location.href ).href; // cache keys are browser-normalized (percent-encoded)
	const sizeLabel = ( bytes ) =>
		bytes < 1048576
			? `${ Math.max( 1, Math.round( bytes / 1024 ) ) } KB`
			: bytes < 10485760
			? `${ ( bytes / 1048576 ).toFixed( 1 ) } MB`
			: `${ Math.round( bytes / 1048576 ) } MB`;
	const dlButton = ( t ) =>
		document.querySelector( `.dl[data-i="${ t._i }"]` );
	const paintDl = ( t, state, progress = 0 ) => {
		const b = dlButton( t );
		if ( ! b ) {
			return;
		}
		b.dataset.state = state;
		b.style.setProperty( '--p', progress.toFixed( 3 ) );
		b.setAttribute(
			'aria-label',
			tpl(
				state === 'saved'
					? T.saved_track
					: state === 'saving'
					? T.saving_track
					: T.save_track,
				t.title
			)
		);
		b.disabled = state === 'saved'; // a saved mark is information, not a control; removal is deliberate, from the set button
	};
	// A copy counts as saved only if it is the file the set describes now: same URL and, when both are
	// known, the same size. A track replaced under the same name gets saved again instead of playing stale.
	async function savedSet( tracks ) {
		const c = await caches.open( CACHE );
		const have = new Set( ( await c.keys() ).map( ( r ) => r.url ) );
		const saved = new Set();
		for ( const t of tracks ) {
			if ( ! have.has( norm( t.url ) ) ) {
				continue;
			}
			const res = await c.match( norm( t.url ) );
			const len = Number( res?.headers.get( 'Content-Length' ) ) || 0;
			if ( t.bytes && len && len !== t.bytes ) {
				continue;
			}
			saved.add( t.url );
		}
		return saved;
	}
	// How much the browser will still let this origin store. Unknown counts as plenty.
	async function freeSpace() {
		try {
			const e = await navigator.storage?.estimate?.();
			return e && e.quota
				? Math.max( 0, e.quota - ( e.usage || 0 ) )
				: Infinity;
		} catch {
			return Infinity;
		}
	}
	async function saveTrack( t, retry = true ) {
		if ( dlAborts.has( t.url ) ) {
			return;
		}
		const ctl = new AbortController();
		dlAborts.set( t.url, ctl );
		paintDl( t, 'saving', 0 );
		if ( ! ls.get( 'callboard:persist' ) ) {
			ls.set( 'callboard:persist', 1 );
			navigator.storage?.persist?.().catch( () => {} ); // keeps saved audio out of eviction where the browser honors it
		}
		try {
			const r = await fetch( t.url, {
				cache: 'no-store',
				signal: ctl.signal,
			} );
			if ( ! r.ok || r.status !== 200 ) {
				throw new Error( r.status );
			}
			const total =
				Number( r.headers.get( 'Content-Length' ) ) || t.bytes || 0;
			const type = r.headers.get( 'Content-Type' ) || 'audio/mpeg';
			const headers = { 'Content-Type': type };
			if ( total ) {
				headers[ 'Content-Length' ] = String( total );
			}
			const c = await caches.open( CACHE );
			if ( r.body && total ) {
				// One branch streams straight into the cache, the other only counts bytes for the ring:
				// the file is never held whole in memory.
				const [ toCache, toCount ] = r.body.tee();
				const count = ( async () => {
					const reader = toCount.getReader();
					let got = 0;
					while ( true ) {
						const { done, value } = await reader.read();
						if ( done ) {
							break;
						}
						got += value.byteLength;
						paintDl( t, 'saving', Math.min( got / total, 0.99 ) );
					}
				} )();
				await Promise.all( [
					c.put(
						norm( t.url ),
						new Response( toCache, { headers } )
					),
					count,
				] );
			} else {
				const body = await r.blob();
				headers[ 'Content-Length' ] = String( body.size );
				await c.put( norm( t.url ), new Response( body, { headers } ) );
			}
			paintDl( t, 'saved', 1 );
			return 'saved';
		} catch ( err ) {
			paintDl( t, '', 0 );
			dlAborts.delete( t.url );
			if ( err?.name === 'QuotaExceededError' ) {
				return 'quota'; // no retry will help; the caller says so
			}
			if ( retry && err?.name !== 'AbortError' && navigator.onLine ) {
				await new Promise( ( r ) => setTimeout( r, 1500 ) );
				return saveTrack( t, false ); // one more try; a dropped connection should not leave a hole
			}
		} finally {
			dlAborts.delete( t.url );
		}
	}
	async function removeTrack( t ) {
		const c = await caches.open( CACHE );
		await c.delete( norm( t.url ) );
		paintDl( t, '', 0 );
	}
	function bindOffline( set ) {
		const offBtn = $( 'offline' );
		if ( ! offBtn ) {
			return;
		}
		if ( ! ( 'caches' in window ) || ! ( 'serviceWorker' in navigator ) ) {
			offBtn.hidden = true; // no store to save into: the one case the button leaves
			return;
		}
		const tracks = set.tracks.map( ( t, idx ) => ( { ...t, _i: idx } ) );
		const total = sizeLabel(
			tracks.reduce( ( a, t ) => a + ( t.bytes || 0 ), 0 )
		);
		const paintAll = async () => {
			const have = await savedSet( tracks );
			tracks.forEach( ( t ) =>
				paintDl(
					t,
					dlAborts.has( t.url )
						? 'saving'
						: have.has( t.url )
						? 'saved'
						: '',
					have.has( t.url ) ? 1 : 0
				)
			);
			const busy = tracks.some( ( t ) => dlAborts.has( t.url ) );
			offBtn.classList.toggle( 'is-busy', busy );
			offBtn.classList.toggle(
				'is-done',
				! busy && have.size === tracks.length
			);
			const rest = sizeLabel(
				tracks
					.filter( ( t ) => ! have.has( t.url ) )
					.reduce( ( a, t ) => a + ( t.bytes || 0 ), 0 )
			);
			offBtn.dataset.some = have.size ? '1' : '';
			offBtn.textContent = busy
				? tpl( T.saving, have.size, tracks.length )
				: have.size === tracks.length
				? T.saved
				: have.size
				? `${ tpl(
						T.save_rest,
						have.size,
						tracks.length
				  ) } · ${ rest }`
				: `${ T.save } · ${ total }`;
			offBtn.setAttribute(
				'aria-label',
				have.size === tracks.length && ! busy ? T.saved_hint : ''
			);
			offBtn.dataset.hint = have.size ? T.saved_hover : '';
			if ( ! offBtn.getAttribute( 'aria-label' ) ) {
				offBtn.removeAttribute( 'aria-label' );
			}
			offBtn.disabled =
				! navigator.onLine && ! busy && have.size !== tracks.length;
		};
		paintAll().catch( () => {} );
		// Once everything is saved the label is information. Removing is for freeing space, so it takes a
		// press-and-hold (or Delete on the keyboard) to ask, then a tap to confirm; it forgets after a moment.
		const arm = async () => {
			if ( ! offBtn.dataset.some || offBtn.dataset.confirm ) {
				return;
			}
			offBtn.dataset.confirm = '1';
			offBtn.textContent = T.remove_confirm;
			setTimeout( () => {
				if ( offBtn.dataset.confirm ) {
					delete offBtn.dataset.confirm;
					paintAll();
				}
			}, 4000 );
		};
		let hold = 0,
			held = false; // the release after a hold is not the confirming tap
		offBtn.onpointerdown = () => {
			clearTimeout( hold );
			held = false;
			if ( offBtn.dataset.some && ! offBtn.dataset.confirm ) {
				haptic(); // the press that starts the hold; the arm itself runs from a timer
			}
			hold = setTimeout( () => {
				held = true;
				arm();
			}, 650 );
		};
		offBtn.onpointerup =
			offBtn.onpointercancel =
			offBtn.onpointerleave =
				() => clearTimeout( hold );
		offBtn.onkeydown = ( e ) => {
			if ( e.key === 'Delete' || e.key === 'Backspace' ) {
				e.preventDefault();
				arm();
			}
		};
		offBtn.onclick = async () => {
			if ( tracks.some( ( t ) => dlAborts.has( t.url ) ) ) {
				haptic();
				dlAborts.forEach( ( ctl ) => ctl.abort() );
				return;
			}
			if ( held ) {
				held = false;
				return;
			}
			haptic(); // the tap itself; the completion below comes long after the gesture
			const have = await savedSet( tracks );
			if ( offBtn.dataset.confirm ) {
				delete offBtn.dataset.confirm;
				await Promise.all( tracks.map( removeTrack ) );
				return paintAll();
			}
			if ( have.size === tracks.length ) {
				return; // a plain tap on "Saved offline" does nothing
			}
			const todo = tracks.filter( ( t ) => ! have.has( t.url ) );
			const need = todo.reduce( ( a, t ) => a + ( t.bytes || 0 ), 0 );
			const free = await freeSpace();
			if ( need && free < need * 1.1 ) {
				return noSpace( free );
			}
			let full = false;
			const worker = async () => {
				while ( todo.length ) {
					if ( ( await saveTrack( todo.shift() ) ) === 'quota' ) {
						todo.length = 0;
						full = true;
					}
					await paintAll();
				}
			};
			await Promise.all( [ worker(), worker() ] );
			warmPage( set.slug ); // the set is saved; its page should open offline too
			if ( full ) {
				return noSpace( await freeSpace() );
			}
			paintAll();
		};
		// The button carries the message for a moment, then goes back to being the button.
		let spaceTimer = 0;
		function noSpace( free ) {
			offBtn.textContent = tpl(
				T.no_space,
				sizeLabel( isFinite( free ) ? free : 0 )
			);
			offBtn.classList.add( 'is-busy' );
			clearTimeout( spaceTimer );
			spaceTimer = setTimeout( () => {
				offBtn.classList.remove( 'is-busy' );
				paintAll();
			}, 3500 );
		}
		document.querySelectorAll( '.dl' ).forEach( ( b ) => {
			b.onclick = async () => {
				haptic();
				const t = tracks[ +b.dataset.i ];
				if ( dlAborts.has( t.url ) ) {
					dlAborts.get( t.url ).abort();
				} else if ( b.dataset.state !== 'saved' ) {
					if ( ( await saveTrack( t ) ) === 'quota' ) {
						return noSpace( await freeSpace() );
					}
				}
				paintAll();
			};
		} );
	}

	// ---- Client-side routing. The server renders every view; on navigation the script fetches the view as an
	// HTML fragment (the same templates, without the shell) and swaps it in under a view transition. One
	// renderer, on the server. The service worker keeps fragments for offline; a saved set's is warmed here.
	// '' = home, 'slug' = a set, null = not ours.
	const homePath = new URL( G.home ).pathname.replace( /\/$/, '' );
	function routeOf( href ) {
		const u = new URL( href, location.href );
		if (
			u.origin !== location.origin ||
			! u.pathname.startsWith( homePath )
		) {
			return null;
		}
		const rest = u.pathname
			.slice( homePath.length )
			.replace( /^\/|\/$/g, '' );
		if ( rest === '' ) {
			return '';
		}
		return setBy( rest ) ? rest : null;
	}
	const fragmentUrl = ( slug ) =>
		`${ G.home }${ slug ? `${ slug }/` : '' }?fragment=1`;
	// slug -> the fragment's HTML once it has arrived, or the promise of it. A touch on a link starts the
	// fetch, so by the time the tap lands the view is usually here. A used copy is refreshed for next time.
	const fragments = new Map();
	function fetchFragment( slug ) {
		const p = fetch( fragmentUrl( slug ), {
			cache: 'no-cache',
			headers: { Accept: 'text/html' },
		} ).then( ( r ) => {
			if ( ! r.ok ) {
				throw new Error( String( r.status ) );
			}
			return r.text();
		} );
		fragments.set( slug, p );
		p.then(
			( html ) => fragments.set( slug, html ),
			() => fragments.delete( slug )
		);
		return p;
	}
	const prefetch = ( slug ) => {
		if ( ! fragments.has( slug ) ) {
			fetchFragment( slug );
		}
	};
	const warmed = new Set();
	function warmPage( slug ) {
		// a saved set has to open offline: fetch its fragment once while online so the worker holds a copy
		if ( warmed.has( slug ) || ! navigator.onLine ) {
			return;
		}
		warmed.add( slug );
		fetch( fragmentUrl( slug ), { cache: 'no-cache' } ).catch( () =>
			warmed.delete( slug )
		);
	}
	async function go( url, push = true, animate = true ) {
		const slug = routeOf( url );
		if ( slug === null ) {
			location.href = url;
			return;
		}
		const set = slug ? setBy( slug ) : null;
		const slow = setTimeout(
			() => document.body.classList.add( 'is-loading' ),
			300
		);
		let html;
		try {
			const have = fragments.get( slug );
			if ( typeof have === 'string' ) {
				html = have;
				fetchFragment( slug ); // this copy is used; the next visit gets a fresh one
			} else {
				html = await ( have || fetchFragment( slug ) );
			}
		} catch {
			clearTimeout( slow );
			document.body.classList.remove( 'is-loading' );
			// offline with no copy: a full navigation, which the worker answers from the shell
			if ( push ) {
				location.href = url;
			} else {
				location.reload();
			}
			return;
		}
		clearTimeout( slow );
		document.body.classList.remove( 'is-loading' );
		if ( push ) {
			history.pushState( {}, '', url );
		}
		const apply = () => {
			const t = document.createElement( 'template' );
			t.innerHTML = html;
			const main = t.content.querySelector( 'main' );
			if ( ! main ) {
				location.href = url;
				return;
			}
			$( 'main' ).replaceWith( main );
			document.title = set ? `${ set.name } · ${ G.site }` : G.site;
			document.body.dataset.slug = slug;
			document.body.classList.toggle( 'view-home', ! slug );
			document.body.classList.toggle( 'view-set', !! slug );
			document.body.classList.add( 'swapped' );
			window.scrollTo( 0, 0 );
			if ( ! lyricsSheet.hidden ) {
				hideLyrics();
			}
			bindView();
		};
		document.documentElement.dataset.nav = slug ? 'forward' : 'back';
		if ( animate && document.startViewTransition ) {
			document.startViewTransition( apply ).finished.finally( () => {
				delete document.documentElement.dataset.nav;
			} );
		} else {
			apply();
			delete document.documentElement.dataset.nav;
		}
	}
	window.addEventListener( 'popstate', ( e ) =>
		go( location.href, false, ! e.hasUAVisualTransition )
	);
	// The first touch on a link starts the fetch; hovering does too. Back to home is prefetched at idle.
	const prefetchLink = ( e ) => {
		const a = e.target.closest?.( 'a[href]' );
		const slug = a && routeOf( a.href );
		if ( slug !== null && slug !== undefined ) {
			prefetch( slug );
		}
	};
	document.addEventListener( 'pointerdown', prefetchLink, { passive: true } );
	document.addEventListener( 'pointerover', prefetchLink, { passive: true } );
	if ( view() ) {
		( window.requestIdleCallback || ( ( f ) => setTimeout( f, 2000 ) ) )(
			() => prefetch( '' )
		);
	}

	bindView();
} )();
