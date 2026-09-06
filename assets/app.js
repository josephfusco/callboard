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
	const esc = ( v ) =>
		String( v ?? '' ).replace(
			/[&<>"']/g,
			( c ) =>
				( {
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#039;',
				} )[ c ]
		);
	const tpl = ( s, ...a ) =>
		s.replace( /%(\d)\$s|%s/g, ( m, n ) => a[ n ? n - 1 : 0 ] );
	const reduce = () =>
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	const setBy = ( slug ) => G.sets.find( ( s ) => s.slug === slug );
	const hasLyrics = ( set, id ) => !! ( set.lyrics && set.lyrics[ id ] );

	( window.requestIdleCallback || ( ( f ) => setTimeout( f, 1000 ) ) )(
		() => {
			if ( 'serviceWorker' in navigator ) {
				navigator.serviceWorker.register( '/sw.js' ).catch( () => {} );
			}
		}
	);
	try {
		if ( navigator.audioSession ) {
			navigator.audioSession.type = 'playback';
		}
	} catch {}

	// ---- Views, rendered from data (same markup the server renders on first load)
	const link = ( text, url ) =>
		url
			? `<a href="${ esc(
					url
			  ) }" target="_blank" rel="nofollow noopener noreferrer">${ esc(
					text
			  ) }</a>`
			: esc( text );
	const footer = ( set ) => {
		if ( ! set ) {
			return `<footer class="colophon">${
				T.footer_note ? `<p>${ esc( T.footer_note ) }</p>` : ''
			}</footer>`;
		}
		const c = set.credits || {},
			names = Object.keys( c.uploaders || {} );
		return `<footer class="colophon">${
			names.length
				? `<p>${ esc( T.audio_by ) } ${ names
						.map( ( n ) => link( n, c.uploaders[ n ] ) )
						.join( ', ' ) }${
						c.playlist_url
							? ` · ${ link( T.playlist, c.playlist_url ) }${
									c.curator
										? ` ${ esc( T.by ) } ${ link(
												c.curator,
												c.curator_url
										  ) }`
										: ''
							  }`
							: ''
				  }</p>`
				: ''
		}</footer>`;
	};
	const renderHome = () => `<main class="app" id="main" tabindex="-1">
<header class="masthead"><h1>${ esc( G.site ) }</h1>${
		G.push
			? `<div class="actions"><button type="button" class="btn btn-quiet" id="notify" hidden>${ esc(
					T.notify
			  ) }</button><p class="note small" id="notify-note" hidden></p></div>`
			: ''
	}</header>
${
	G.sets.length
		? `<ul class="sets">${ G.sets
				.map(
					( s ) =>
						`<li><a class="set" href="${ esc( G.home ) }${ esc(
							s.slug
						) }/"><span class="set-mark" aria-hidden="true">${ esc(
							s.name.slice( 0, 1 ).toUpperCase()
						) }</span><span class="set-text"><span class="set-name" style="view-transition-name:set-${ esc(
							s.slug
						) }">${ esc(
							s.name
						) }</span><span class="set-meta">${ esc(
							s.meta
						) }</span></span><span class="set-go" aria-hidden="true"></span></a></li>`
				)
				.join( '' ) }</ul>`
		: `<p class="note">${ esc( T.nothing ) }</p>`
}
${ footer( null ) }
</main>`;
	const renderSet = ( s ) => `<main class="app" id="main" tabindex="-1">
<header class="masthead">
<a class="back" href="${ esc( G.home ) }">${ esc( T.all_sets ) }</a>
<h1 style="view-transition-name:set-${ esc( s.slug ) }">${ esc( s.name ) }</h1>
<p class="label">${ esc( s.meta ) }</p>
<div class="actions"><button type="button" class="btn" id="play-all">${ esc(
		T.play_all
	) }</button>${
		S.offline
			? `<button type="button" class="btn btn-quiet" id="offline" hidden>${ esc(
					T.save
			  ) }</button>`
			: ''
	}</div>
</header>
${
	s.tracks.length
		? `<ol class="tracks" id="tracks" aria-label="${ esc(
				T.tracks
		  ) }">${ s.tracks
				.map(
					( t, i ) =>
						`<li><button type="button" class="track" data-i="${ i }" aria-label="${ esc(
							tpl( T.play, t.title )
						) }"><span class="num"><span class="digits">${ String(
							t.index
						).padStart(
							2,
							'0'
						) }</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span><span class="title">${ esc(
							t.title
						) }${
							hasLyrics( s, t.id )
								? ` <span class="has-lyrics">${ esc(
										T.lyrics
								  ) }</span>`
								: ''
						}</span><span class="len">${
							S.badge
								? `<span class="hh" aria-hidden="true">${ esc(
										S.badge
								  ) }</span>`
								: ''
						}${ fmt( t.duration ) }</span></button></li>`
				)
				.join( '' ) }</ol>`
		: `<p class="note">${ esc( T.no_audio ) }</p>`
}
${ footer( s ) }
</main>`;

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

	const isIOS = /iphone|ipad|ipod/i.test( navigator.userAgent );
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
	};
	const eqStart = ( row ) => {
		eqStop();
		if ( reduce() ) {
			return; // the static bars still mark the playing row
		}
		if ( analyser && row ) {
			// real levels: three bands, transforms only
			const bars = row.querySelectorAll( '.eq i' ),
				data = new Uint8Array( analyser.frequencyBinCount );
			const bands = [
				[ 1, 4 ],
				[ 4, 10 ],
				[ 10, 24 ],
			];
			const tick = () => {
				analyser.getByteFrequencyData( data );
				bands.forEach( ( [ a, b ], k ) => {
					let sum = 0;
					for ( let n = a; n < b; n++ ) {
						sum += data[ n ];
					}
					const level =
						0.3 + 0.7 * Math.min( 1, sum / ( b - a ) / 200 );
					if ( bars[ k ] ) {
						bars[ k ].style.transform = `scaleY(${ level.toFixed(
							2
						) })`;
					}
				} );
				eqRaf = requestAnimationFrame( tick );
			};
			tick();
			return;
		}
		row?.querySelectorAll( '.eq i' ).forEach( ( bar, k ) =>
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
	}
	function setTitle( text ) {
		const mq = nowTitle.firstElementChild;
		mq.innerHTML = '';
		const a = document.createElement( 'span' );
		a.textContent = text;
		mq.appendChild( a );
		nowTitle.classList.remove( 'marquee' );
		if ( a.scrollWidth > nowTitle.clientWidth + 2 ) {
			const b = a.cloneNode( true );
			b.setAttribute( 'aria-hidden', 'true' );
			mq.appendChild( b );
			nowTitle.style.setProperty(
				'--mq-dur',
				`${ Math.max( 8, a.scrollWidth / 28 ) }s`
			);
			nowTitle.classList.add( 'marquee' );
		}
		retrigger( nowTitle, 'swap' );
	}
	const remember = () => {
		if ( queue ) {
			ls.set( key(), { i, t: Math.floor( audio.currentTime || 0 ) } );
		}
	};
	const seekKnob = $( 'seek-knob' );
	let seekWidth = 0;
	const measureSeek = () => {
		seekWidth = seek.clientWidth - ( seekKnob ? seekKnob.offsetWidth : 0 );
	};
	window.addEventListener( 'resize', measureSeek );
	const setProgress = ( ratio ) => {
		if ( ! seekWidth ) {
			measureSeek();
		}
		seek.value = Math.round( ratio * 1000 );
		seekFill.style.transform = `scaleX(${ ratio })`;
		if ( seekKnob ) {
			seekKnob.style.transform = `translateX(${ (
				ratio * seekWidth
			).toFixed( 1 ) }px)`;
		}
	};
	function paint( force = false ) {
		const d = audio.duration || queue?.tracks[ i ]?.duration,
			sec = Math.floor( audio.currentTime );
		if ( ! seeking && d ) {
			setProgress( Math.min( audio.currentTime / d, 1 ) );
		}
		if ( sec === lastSec && ! force ) {
			return;
		}
		lastSec = sec;
		if ( ! seeking ) {
			cur.textContent = fmt( audio.currentTime );
			if ( d ) {
				seek.setAttribute(
					'aria-valuetext',
					`${ fmt( audio.currentTime ) } / ${ fmt( d ) }`
				);
			}
		}
		if ( S.confetti && /^\d+$/.test( S.confetti ) ) {
			cur.classList.toggle(
				'is-lucky',
				sec % 60 === Number( S.confetti ) % 60
			);
		}
		syncLyrics( audio.currentTime );
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
				position: Math.min( audio.currentTime, d ),
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
		if ( at ) {
			audio.currentTime = at;
		}
		setTitle( t.title );
		dur.textContent = fmt( t.duration );
		lastSec = -1;
		setProgress( 0 );
		paint( true );
		deck.hidden = false;
		document.body.classList.add( 'has-deck' );
		renderLyrics( t.id );
		syncRows();
		if ( play ) {
			ensureAnalyser();
			audio.play().catch( () => {} );
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
				audio.play()
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
		retrigger( $( 'prev' ), 'kick-l' );
		prev();
	} );
	$( 'next' ).addEventListener( 'click', () => {
		retrigger( $( 'next' ), 'kick-r' );
		load( i < 0 ? 0 : i + 1 );
	} );
	toggle.addEventListener( 'click', () =>
		i < 0 ? load( 0 ) : audio.paused ? audio.play() : audio.pause()
	);
	const morph = ( to ) => {
		const path = $( 'pp-path' ),
			anim = $( 'pp-anim' );
		if ( ! path || path.dataset.state === to ) {
			return;
		}
		const fromShape = path.dataset[ path.dataset.state || 'play' ],
			toShape = path.dataset[ to ];
		path.dataset.state = to;
		if ( anim && anim.beginElement ) {
			anim.setAttribute( 'from', fromShape );
			anim.setAttribute( 'to', toShape );
			anim.beginElement();
		} else {
			path.setAttribute( 'd', toShape );
		}
	};
	audio.addEventListener( 'play', () => {
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
	seek.addEventListener( 'input', () => {
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
		if ( d ) {
			audio.currentTime = ( seek.value / 1000 ) * d;
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
		} else if ( e.key === 'Escape' && ! lyricsSheet.hidden ) {
			hideLyrics();
		}
	} );

	// ---- Lyrics (only where a set has approved lyrics); otherwise the deck title finds the playing track
	function renderLyrics( id ) {
		cues = ( queue?.lyrics && queue.lyrics[ id ] ) || [];
		cueIdx = -1;
		lyricsList.innerHTML = '';
		openLyrics.classList.toggle( 'has-lyrics', cues.length > 0 );
		openLyrics.setAttribute(
			'aria-label',
			cues.length ? T.show_lyrics : T.show_track
		);
		cueEls = cues.map( ( [ s, , text ] ) => {
			const li = document.createElement( 'li' );
			li.textContent = text;
			li.tabIndex = 0;
			li.addEventListener( 'click', () => {
				audio.currentTime = s;
				audio.play().catch( () => {} );
			} );
			lyricsList.appendChild( li );
			return li;
		} );
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
	function showLyrics() {
		keepAwake();
		lyricsSheet.hidden = false;
		openLyrics.setAttribute( 'aria-expanded', 'true' );
		openLyrics.setAttribute( 'aria-label', T.hide_lyrics );
		if ( cueIdx >= 0 ) {
			cueEls[ cueIdx ].scrollIntoView( { block: 'center' } );
		}
		$( 'close-lyrics' ).focus();
	}
	function hideLyrics() {
		letSleep();
		lyricsSheet.hidden = true;
		openLyrics.setAttribute( 'aria-expanded', 'false' );
		openLyrics.setAttribute( 'aria-label', T.show_lyrics );
		openLyrics.focus();
	}
	openLyrics.addEventListener( 'click', () => {
		if ( i < 0 ) {
			return;
		}
		if ( cues.length ) {
			return lyricsSheet.hidden ? showLyrics() : hideLyrics();
		}
		if ( ! onQueuePage() ) {
			return go( `${ G.home }${ queue.slug }/` );
		}
		rows[ i ]?.scrollIntoView( { block: 'center', behavior: 'smooth' } );
		rows[ i ]?.focus( { preventScroll: true } );
	} );
	$( 'close-lyrics' ).addEventListener( 'click', hideLyrics );

	document
		.querySelector( '.skip-link' )
		?.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			$( 'main' ).focus();
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
			if ( onQueuePage() && n === i ) {
				audio.paused ? audio.play() : audio.pause();
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
		if ( routeOf( a.href ) === null ) {
			return;
		}
		e.preventDefault();
		go( a.href );
	} );

	// ---- Home Screen hint: one element, shown on set pages in iOS Safari until dismissed
	const tip = $( 'a2hs' );
	const standalone =
		window.matchMedia( '(display-mode: standalone)' ).matches ||
		navigator.standalone === true;
	let tipWanted =
		S.hint &&
		/iphone|ipad|ipod/i.test( navigator.userAgent ) &&
		! standalone &&
		! ls.get( 'callboard:a2hs' );
	$( 'a2hs-close' )?.addEventListener( 'click', () => {
		tipWanted = false;
		tip.hidden = true;
		ls.set( 'callboard:a2hs', 1 );
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
	async function bindNotify() {
		const btn = $( 'notify' ),
			note = $( 'notify-note' );
		if (
			! btn ||
			! G.push ||
			! ( 'serviceWorker' in navigator ) ||
			! ( 'PushManager' in window ) ||
			! ( 'Notification' in window )
		) {
			return;
		}
		if ( isIOS && ! standalone ) {
			note.textContent = T.notify_home;
			note.hidden = false;
			return;
		}
		if ( Notification.permission === 'denied' ) {
			note.textContent = T.notify_denied;
			note.hidden = false;
			return;
		}
		const reg = await navigator.serviceWorker.ready;
		let sub = await reg.pushManager.getSubscription();
		const paintBtn = () => {
			btn.hidden = false;
			btn.textContent = sub ? T.notify_on : T.notify;
			btn.classList.toggle( 'is-done', !! sub );
			btn.setAttribute( 'aria-pressed', sub ? 'true' : 'false' );
		};
		paintBtn();
		btn.onclick = async () => {
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
				} else {
					if (
						( await Notification.requestPermission() ) !== 'granted'
					) {
						note.textContent = T.notify_denied;
						note.hidden = false;
						return;
					}
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
					}
				}
			} catch {}
			btn.disabled = false;
			paintBtn();
		};
	}

	// ---- Per-view bindings (first load and after every render)
	function bindView() {
		const set = setBy( view() );
		$( 'topbar-title' ).textContent = set ? set.name : G.site;
		if ( ! set ) {
			bindNotify().catch( () => {} );
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
			$( 'play-all' )?.addEventListener( 'click', () =>
				startSet( set, 0 )
			);
			setTimeout( () => bindOffline( set ), 700 );
		}
		if ( tip ) {
			tip.hidden = ! ( set && tipWanted );
		}
		syncRows();
	}
	function bindOffline( set ) {
		const offBtn = $( 'offline' );
		if (
			! offBtn ||
			! ( 'caches' in window ) ||
			! ( 'serviceWorker' in navigator )
		) {
			return;
		}
		const CACHE = 'callboard-audio-v1',
			tracks = set.tracks;
		const bytes = tracks.reduce( ( a, t ) => a + ( t.bytes || 0 ), 0 );
		const mb =
			bytes < 1048576
				? `${ Math.max( 1, Math.round( bytes / 1024 ) ) } KB`
				: bytes < 10485760
				? `${ ( bytes / 1048576 ).toFixed( 1 ) } MB`
				: `${ Math.round( bytes / 1048576 ) } MB`;
		let busy = false,
			abort = null;
		const saved = async () => {
			const c = await caches.open( CACHE );
			const have = new Set( ( await c.keys() ).map( ( r ) => r.url ) );
			return tracks.filter( ( t ) => have.has( t.url ) ).length;
		};
		const paintBtn = async () => {
			const n = await saved();
			offBtn.hidden = false;
			offBtn.disabled = false;
			busy = false;
			offBtn.classList.toggle( 'is-done', n === tracks.length );
			offBtn.classList.remove( 'is-busy' );
			offBtn.textContent =
				n === tracks.length ? T.saved : `${ T.save } · ${ mb }`;
		};
		paintBtn().catch( () => {} );
		offBtn.addEventListener( 'click', async () => {
			if ( busy ) {
				abort?.abort();
				return;
			}
			const c = await caches.open( CACHE );
			if ( offBtn.classList.contains( 'is-done' ) ) {
				await Promise.all( tracks.map( ( t ) => c.delete( t.url ) ) );
				return paintBtn();
			}
			busy = true;
			abort = new AbortController();
			offBtn.classList.add( 'is-busy' );
			let n = await saved();
			try {
				if ( navigator.storage?.estimate ) {
					// don't start what can't finish
					const { quota = 0, usage = 0 } =
						await navigator.storage.estimate();
					const need = tracks.reduce(
						( a, t ) => a + ( t.bytes || 0 ),
						0
					);
					if ( quota && quota - usage < need * 1.1 ) {
						throw new Error( 'quota' );
					}
				}
				const todo = [];
				for ( const t of tracks ) {
					if ( ! ( await c.match( t.url ) ) ) {
						todo.push( t );
					}
				}
				const worker = async () => {
					while ( todo.length ) {
						const t = todo.shift();
						offBtn.textContent = tpl(
							T.saving,
							n + 1,
							tracks.length
						);
						const r = await fetch( t.url, {
							cache: 'no-store',
							signal: abort.signal,
						} );
						if ( r.ok && r.status === 200 ) {
							await c.put( t.url, r );
							n++;
						}
					}
				};
				await Promise.all( [ worker(), worker() ] ); // two at a time: faster on good networks, gentle on weak ones
			} catch {}
			if ( abort.signal.aborted || n < tracks.length ) {
				await Promise.all( tracks.map( ( t ) => c.delete( t.url ) ) );
			}
			paintBtn();
		} );
	}

	// ---- Client-side routing: render from data, no fetches. '' = home, 'slug' = a set, null = not ours.
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
	function go( url, push = true, animate = true ) {
		const slug = routeOf( url );
		if ( slug === null ) {
			location.href = url;
			return;
		}
		const set = slug ? setBy( slug ) : null;
		if ( push ) {
			history.pushState( {}, '', url );
		}
		const apply = () => {
			const t = document.createElement( 'template' );
			t.innerHTML = set ? renderSet( set ) : renderHome();
			$( 'main' ).replaceWith( t.content.firstElementChild );
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

	bindView();
} )();
