/* eslint-disable no-console -- a command-line script; it talks. */
/* Fixture audio for tests and the Playground demo: ten famous melodies as chiptunes.

   Every melody is public domain (Beethoven, Bach, Mozart, Grieg, Pachelbel, Bizet, Joplin, two folk tunes) and
   every recording is rendered here by a small synth in the manner of an 80s home keyboard with presets, so the
   repository owns the audio outright: a lead voice per piece (square lead, FM electric piano, organ, brass,
   strings, flute), an auto-accompaniment of bass and arpeggiated chords, and a rhythm box of kick, snare and hat.

   demo-set gets one 40-second rendering per piece. long-set (24 tracks) and one-track keep their titles, ids
   and sidecars (lyrics, notes, tempo are keyed by id) and take windows from the same ten renderings.

   Run: node tests/fixtures/chiptunes.js (needs ffmpeg and ffprobe on PATH). Rewrites the mp3s, manifest.json
   and levels.json of demo-set, long-set and one-track. */
const fs = require( 'fs' );
const os = require( 'os' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const ROOT = path.join( __dirname, 'callboard' );
const SR = 32000;
const LENGTH = 40;

/* ---------------------------------------------------------------- the songs
   Melodies as [note, beats]; "-" is a rest. Chords as [name, beats] under them. A song loops until it fills
   the length. Beats are quarter notes unless the piece says otherwise (then they are eighths). */
const SONGS = [
	{
		id: 'chip01',
		title: 'Ode to Joy',
		composer: 'Ludwig van Beethoven',
		bpm: 118,
		lead: 'organ',
		drums: 'light',
		melody: [
			[ 'E4', 1 ],
			[ 'E4', 1 ],
			[ 'F4', 1 ],
			[ 'G4', 1 ],
			[ 'G4', 1 ],
			[ 'F4', 1 ],
			[ 'E4', 1 ],
			[ 'D4', 1 ],
			[ 'C4', 1 ],
			[ 'C4', 1 ],
			[ 'D4', 1 ],
			[ 'E4', 1 ],
			[ 'E4', 1.5 ],
			[ 'D4', 0.5 ],
			[ 'D4', 2 ],
			[ 'E4', 1 ],
			[ 'E4', 1 ],
			[ 'F4', 1 ],
			[ 'G4', 1 ],
			[ 'G4', 1 ],
			[ 'F4', 1 ],
			[ 'E4', 1 ],
			[ 'D4', 1 ],
			[ 'C4', 1 ],
			[ 'C4', 1 ],
			[ 'D4', 1 ],
			[ 'E4', 1 ],
			[ 'D4', 1.5 ],
			[ 'C4', 0.5 ],
			[ 'C4', 2 ],
			[ 'D4', 1 ],
			[ 'D4', 1 ],
			[ 'E4', 1 ],
			[ 'C4', 1 ],
			[ 'D4', 1 ],
			[ 'E4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'E4', 1 ],
			[ 'C4', 1 ],
			[ 'D4', 1 ],
			[ 'E4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'E4', 1 ],
			[ 'D4', 1 ],
			[ 'C4', 1 ],
			[ 'D4', 1 ],
			[ 'G3', 2 ],
			[ 'E4', 1 ],
			[ 'E4', 1 ],
			[ 'F4', 1 ],
			[ 'G4', 1 ],
			[ 'G4', 1 ],
			[ 'F4', 1 ],
			[ 'E4', 1 ],
			[ 'D4', 1 ],
			[ 'C4', 1 ],
			[ 'C4', 1 ],
			[ 'D4', 1 ],
			[ 'E4', 1 ],
			[ 'D4', 1.5 ],
			[ 'C4', 0.5 ],
			[ 'C4', 2 ],
		],
		chords: [
			[ 'C', 4 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'F', 2 ],
			[ 'C', 2 ],
			[ 'G', 2 ],
			[ 'G', 2 ],
			[ 'C', 4 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'F', 2 ],
			[ 'C', 2 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'G', 4 ],
			[ 'C', 4 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
			[ 'F', 2 ],
			[ 'C', 2 ],
			[ 'G', 2 ],
			[ 'C', 2 ],
		],
	},
	{
		id: 'chip02',
		title: 'Korobeiniki',
		composer: 'Russian folk song',
		bpm: 150,
		lead: 'square',
		drums: 'full',
		melody: [
			[ 'E5', 1 ],
			[ 'B4', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'D5', 1 ],
			[ 'C5', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'A4', 1 ],
			[ 'A4', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'E5', 1 ],
			[ 'D5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'B4', 1.5 ],
			[ 'C5', 0.5 ],
			[ 'D5', 1 ],
			[ 'E5', 1 ],
			[ 'C5', 1 ],
			[ 'A4', 1 ],
			[ 'A4', 1 ],
			[ '-', 1 ],
			[ '-', 0.5 ],
			[ 'D5', 1 ],
			[ 'F5', 0.5 ],
			[ 'A5', 1 ],
			[ 'G5', 0.5 ],
			[ 'F5', 0.5 ],
			[ 'E5', 1.5 ],
			[ 'C5', 0.5 ],
			[ 'E5', 1 ],
			[ 'D5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'B4', 1 ],
			[ 'B4', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'D5', 1 ],
			[ 'E5', 1 ],
			[ 'C5', 1 ],
			[ 'A4', 1 ],
			[ 'A4', 1 ],
			[ '-', 1 ],
		],
		chords: [
			[ 'Am', 4 ],
			[ 'E', 4 ],
			[ 'Am', 4 ],
			[ 'Am', 4 ],
			[ 'Dm', 4 ],
			[ 'Am', 4 ],
			[ 'E', 4 ],
			[ 'Am', 4 ],
		],
	},
	{
		id: 'chip03',
		title: 'Für Elise',
		composer: 'Ludwig van Beethoven',
		bpm: 170,
		eighths: true,
		lead: 'epiano',
		drums: 'none',
		melody: [
			[ 'E5', 1 ],
			[ 'D#5', 1 ],
			[ 'E5', 1 ],
			[ 'D#5', 1 ],
			[ 'E5', 1 ],
			[ 'B4', 1 ],
			[ 'D5', 1 ],
			[ 'C5', 1 ],
			[ 'A4', 2 ],
			[ 'C4', 1 ],
			[ 'E4', 1 ],
			[ 'A4', 1 ],
			[ 'B4', 2 ],
			[ 'E4', 1 ],
			[ 'G#4', 1 ],
			[ 'B4', 1 ],
			[ 'C5', 2 ],
			[ 'E4', 1 ],
			[ 'E5', 1 ],
			[ 'D#5', 1 ],
			[ 'E5', 1 ],
			[ 'D#5', 1 ],
			[ 'E5', 1 ],
			[ 'B4', 1 ],
			[ 'D5', 1 ],
			[ 'C5', 1 ],
			[ 'A4', 2 ],
			[ 'C4', 1 ],
			[ 'E4', 1 ],
			[ 'A4', 1 ],
			[ 'B4', 2 ],
			[ 'E4', 1 ],
			[ 'C5', 1 ],
			[ 'B4', 1 ],
			[ 'A4', 3 ],
			[ '-', 1 ],
		],
		chords: [
			[ 'Am', 2 ],
			[ 'Am', 6 ],
			[ 'Am', 3 ],
			[ 'E', 3 ],
			[ 'Am', 3 ],
			[ 'Am', 6 ],
			[ 'Am', 3 ],
			[ 'E', 3 ],
			[ 'Am', 4 ],
		],
		arp: 'slow',
	},
	{
		id: 'chip04',
		title: 'Greensleeves',
		composer: 'English folk song',
		bpm: 176,
		eighths: true,
		lead: 'flute',
		drums: 'light',
		melody: [
			[ 'A4', 1 ],
			[ 'C5', 2 ],
			[ 'D5', 1 ],
			[ 'E5', 1.5 ],
			[ 'F5', 0.5 ],
			[ 'E5', 1 ],
			[ 'D5', 2 ],
			[ 'B4', 1 ],
			[ 'G4', 1.5 ],
			[ 'A4', 0.5 ],
			[ 'B4', 1 ],
			[ 'C5', 2 ],
			[ 'A4', 1 ],
			[ 'A4', 1.5 ],
			[ 'G#4', 0.5 ],
			[ 'A4', 1 ],
			[ 'B4', 2 ],
			[ 'G#4', 1 ],
			[ 'E4', 2 ],
			[ 'A4', 1 ],
			[ 'C5', 2 ],
			[ 'D5', 1 ],
			[ 'E5', 1.5 ],
			[ 'F5', 0.5 ],
			[ 'E5', 1 ],
			[ 'D5', 2 ],
			[ 'B4', 1 ],
			[ 'G4', 1.5 ],
			[ 'A4', 0.5 ],
			[ 'B4', 1 ],
			[ 'C5', 1.5 ],
			[ 'B4', 0.5 ],
			[ 'A4', 1 ],
			[ 'G#4', 1.5 ],
			[ 'F#4', 0.5 ],
			[ 'G#4', 1 ],
			[ 'A4', 3 ],
			[ '-', 2 ],
		],
		chords: [
			[ 'Am', 1 ],
			[ 'Am', 6 ],
			[ 'G', 6 ],
			[ 'Am', 6 ],
			[ 'E', 6 ],
			[ 'Am', 6 ],
			[ 'G', 6 ],
			[ 'E', 6 ],
			[ 'Am', 5 ],
		],
		arp: 'slow',
	},
	{
		id: 'chip05',
		title: 'In the Hall of the Mountain King',
		composer: 'Edvard Grieg',
		bpm: 132,
		lead: 'brass',
		drums: 'march',
		melody: [
			[ 'B3', 0.5 ],
			[ 'C#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'F#4', 1 ],
			[ 'F4', 0.5 ],
			[ 'C#4', 0.5 ],
			[ 'F4', 1 ],
			[ 'E4', 0.5 ],
			[ 'C4', 0.5 ],
			[ 'E4', 1 ],
			[ 'B3', 0.5 ],
			[ 'C#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'A4', 2 ],
			[ 'B4', 0.5 ],
			[ 'C#5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'E5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'F#5', 1 ],
			[ 'F5', 0.5 ],
			[ 'C#5', 0.5 ],
			[ 'F5', 1 ],
			[ 'E5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'E5', 1 ],
			[ 'B4', 0.5 ],
			[ 'C#5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'E5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'B5', 0.5 ],
			[ 'A5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'A5', 2 ],
		],
		chords: [
			[ 'Bm', 4 ],
			[ 'Bm', 4 ],
			[ 'Bm', 4 ],
			[ 'F#', 2 ],
			[ 'Bm', 2 ],
			[ 'Bm', 4 ],
			[ 'Bm', 4 ],
			[ 'Bm', 4 ],
			[ 'F#', 2 ],
			[ 'Bm', 2 ],
		],
	},
	{
		id: 'chip06',
		title: 'Eine kleine Nachtmusik',
		composer: 'Wolfgang Amadeus Mozart',
		bpm: 132,
		lead: 'strings',
		drums: 'light',
		melody: [
			[ 'G4', 1 ],
			[ '-', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'G4', 1 ],
			[ '-', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'D5', 2 ],
			[ 'C5', 1 ],
			[ '-', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'C5', 1 ],
			[ '-', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'D4', 2 ],
			[ 'G4', 1 ],
			[ 'G4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'E5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'G5', 0.5 ],
			[ 'A5', 1 ],
			[ 'F#5', 1 ],
			[ 'D5', 1 ],
			[ 'B4', 1 ],
			[ 'G4', 1 ],
			[ 'D4', 1 ],
			[ 'G4', 2 ],
		],
		chords: [
			[ 'G', 4 ],
			[ 'G', 4 ],
			[ 'D7', 4 ],
			[ 'D7', 4 ],
			[ 'G', 4 ],
			[ 'G', 4 ],
			[ 'D7', 4 ],
			[ 'G', 4 ],
		],
	},
	{
		id: 'chip07',
		title: 'The Entertainer',
		composer: 'Scott Joplin',
		bpm: 96,
		lead: 'epiano',
		drums: 'rag',
		melody: [
			[ 'D4', 0.5 ],
			[ 'D#4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'C5', 1 ],
			[ 'E4', 0.5 ],
			[ 'C5', 1 ],
			[ 'E4', 0.5 ],
			[ 'C5', 2.5 ],
			[ 'C5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'D#5', 0.5 ],
			[ 'E5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'E5', 1 ],
			[ 'B4', 0.5 ],
			[ 'D5', 1 ],
			[ 'C5', 2.5 ],
			[ 'D4', 0.5 ],
			[ 'D#4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'C5', 1 ],
			[ 'E4', 0.5 ],
			[ 'C5', 1 ],
			[ 'E4', 0.5 ],
			[ 'C5', 2.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'E5', 1 ],
			[ 'D5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'D5', 3 ],
		],
		chords: [
			[ 'C', 1.5 ],
			[ 'C', 4 ],
			[ 'C', 2.5 ],
			[ 'G7', 2 ],
			[ 'C', 2 ],
			[ 'C', 4 ],
			[ 'C', 1.5 ],
			[ 'C', 4 ],
			[ 'F', 2 ],
			[ 'C', 2 ],
			[ 'G7', 2 ],
			[ 'C', 2 ],
		],
	},
	{
		id: 'chip08',
		title: 'Habanera',
		composer: 'Georges Bizet',
		bpm: 72,
		lead: 'brass',
		drums: 'habanera',
		melody: [
			[ 'D5', 1 ],
			[ 'C#5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'B4', 1 ],
			[ 'Bb4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'Bb4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'D4', 1 ],
			[ '-', 1 ],
			[ 'A4', 1 ],
			[ 'A4', 1 ],
			[ 'D5', 1 ],
			[ 'C#5', 0.5 ],
			[ 'C5', 0.5 ],
			[ 'B4', 1 ],
			[ 'Bb4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'Bb4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'E4', 1 ],
			[ 'F4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'A4', 1 ],
			[ 'F4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'D4', 2 ],
			[ '-', 2 ],
		],
		chords: [
			[ 'Dm', 4 ],
			[ 'Dm', 4 ],
			[ 'A', 4 ],
			[ 'Dm', 4 ],
			[ 'Dm', 4 ],
			[ 'Dm', 4 ],
			[ 'A', 4 ],
			[ 'Dm', 4 ],
		],
	},
	{
		id: 'chip09',
		title: 'Canon in D',
		composer: 'Johann Pachelbel',
		bpm: 64,
		lead: 'strings',
		drums: 'none',
		arp: 'fast',
		melody: [
			[ 'F#5', 2 ],
			[ 'E5', 2 ],
			[ 'D5', 2 ],
			[ 'C#5', 2 ],
			[ 'B4', 2 ],
			[ 'A4', 2 ],
			[ 'B4', 2 ],
			[ 'C#5', 2 ],
			[ 'D5', 1 ],
			[ 'C#5', 1 ],
			[ 'B4', 1 ],
			[ 'A4', 1 ],
			[ 'G4', 1 ],
			[ 'F#4', 1 ],
			[ 'G4', 1 ],
			[ 'E4', 1 ],
			[ 'D4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'B3', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'C#5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'F#5', 0.5 ],
			[ 'A5', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'B4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'A4', 0.5 ],
			[ 'F#4', 0.5 ],
			[ 'D4', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'D5', 0.5 ],
			[ 'C#5', 0.5 ],
		],
		chords: [
			[ 'D', 2 ],
			[ 'A', 2 ],
			[ 'Bm', 2 ],
			[ 'F#m', 2 ],
			[ 'G', 2 ],
			[ 'D', 2 ],
			[ 'G', 2 ],
			[ 'A', 2 ],
		],
	},
	{
		id: 'chip10',
		title: 'Toccata in D minor',
		composer: 'Johann Sebastian Bach',
		bpm: 66,
		lead: 'organ',
		drums: 'none',
		arp: 'slow',
		melody: [
			[ 'A5', 0.25 ],
			[ 'G5', 0.25 ],
			[ 'A5', 1.5 ],
			[ '-', 1 ],
			[ 'G5', 0.25 ],
			[ 'F5', 0.25 ],
			[ 'E5', 0.25 ],
			[ 'D5', 0.25 ],
			[ 'C#5', 0.5 ],
			[ 'D5', 1.5 ],
			[ '-', 1 ],
			[ 'A4', 0.25 ],
			[ 'G4', 0.25 ],
			[ 'A4', 1.5 ],
			[ '-', 1 ],
			[ 'E4', 0.5 ],
			[ 'F4', 0.5 ],
			[ 'C#4', 0.5 ],
			[ 'D4', 1.5 ],
			[ '-', 1 ],
			[ 'A3', 0.25 ],
			[ 'G3', 0.25 ],
			[ 'A3', 1.5 ],
			[ '-', 1 ],
			[ 'C#4', 0.5 ],
			[ 'E4', 0.5 ],
			[ 'G4', 0.5 ],
			[ 'Bb4', 0.5 ],
			[ 'C#5', 0.5 ],
			[ 'E5', 0.5 ],
			[ 'G5', 0.5 ],
			[ 'A5', 0.5 ],
			[ 'Bb5', 1 ],
			[ 'A5', 1 ],
			[ 'G5', 1 ],
			[ 'F5', 1 ],
			[ 'E5', 1 ],
			[ 'D5', 1 ],
			[ 'C#5', 1 ],
			[ 'D5', 3 ],
			[ '-', 1 ],
		],
		chords: [
			[ 'Dm', 3 ],
			[ 'A', 3.5 ],
			[ 'Dm', 3 ],
			[ 'A', 3 ],
			[ 'Dm', 3 ],
			[ 'A7', 4 ],
			[ 'Dm', 4 ],
			[ 'A', 4 ],
			[ 'Dm', 4 ],
		],
	},
];

/* ---------------------------------------------------------------- the synth */
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz( name ) {
	const m = /^([A-G])([#b]?)(-?\d)$/.exec( name );
	const semis =
		NOTE[ m[ 1 ] ] + ( m[ 2 ] === '#' ? 1 : m[ 2 ] === 'b' ? -1 : 0 );
	return 440 * Math.pow( 2, ( 12 * ( +m[ 3 ] + 1 ) + semis - 69 ) / 12 );
}
function midi( name ) {
	const m = /^([A-G])([#b]?)(-?\d)$/.exec( name );
	return (
		12 * ( +m[ 3 ] + 1 ) +
		NOTE[ m[ 1 ] ] +
		( m[ 2 ] === '#' ? 1 : m[ 2 ] === 'b' ? -1 : 0 )
	);
}
const mhz = ( n ) => 440 * Math.pow( 2, ( n - 69 ) / 12 );
const CHORD = { '': [ 0, 4, 7 ], m: [ 0, 3, 7 ], 7: [ 0, 4, 7, 10 ] };
function chordNotes( name ) {
	const m = /^([A-G][#b]?)(m|7)?$/.exec( name );
	const root = midi( `${ m[ 1 ] }2` );
	return CHORD[ m[ 2 ] || '' ].map( ( i ) => root + i );
}

/* The presets, the way a home keyboard names them. Each is a waveform plus the envelope that sells it. */
const PRESETS = {
	square: {
		wave: 'pulse',
		duty: 0.5,
		gain: 0.17,
		attack: 0.004,
		decay: 0.12,
		sustain: 0.7,
		release: 0.04,
		vib: 0.005,
	},
	epiano: {
		wave: 'fm',
		gain: 0.24,
		attack: 0.002,
		decay: 0.55,
		sustain: 0.25,
		release: 0.12,
		vib: 0,
	},
	organ: {
		wave: 'organ',
		gain: 0.16,
		attack: 0.01,
		decay: 0.05,
		sustain: 0.95,
		release: 0.05,
		vib: 0.003,
	},
	brass: {
		wave: 'saw',
		gain: 0.15,
		attack: 0.05,
		decay: 0.15,
		sustain: 0.8,
		release: 0.06,
		vib: 0.006,
	},
	strings: {
		wave: 'strings',
		gain: 0.15,
		attack: 0.12,
		decay: 0.2,
		sustain: 0.9,
		release: 0.18,
		vib: 0.005,
	},
	flute: {
		wave: 'sine',
		gain: 0.24,
		attack: 0.04,
		decay: 0.1,
		sustain: 0.85,
		release: 0.08,
		vib: 0.008,
	},
	bass: {
		wave: 'tri',
		gain: 0.26,
		attack: 0.003,
		decay: 0.05,
		sustain: 0.85,
		release: 0.02,
		vib: 0,
	},
	arp: {
		wave: 'pulse',
		duty: 0.125,
		gain: 0.06,
		attack: 0.002,
		decay: 0.06,
		sustain: 0.5,
		release: 0.02,
		vib: 0,
	},
};
/* One voice: a waveform, an envelope, optional vibrato, written into the mix at a time. */
function voice(
	mix,
	start,
	dur,
	freq,
	{
		wave = 'pulse',
		duty = 0.5,
		gain = 0.2,
		attack = 0.004,
		decay = 0.08,
		sustain = 0.6,
		release = 0.03,
		vib = 0,
	}
) {
	const n = Math.min(
		mix.length - Math.floor( start * SR ),
		Math.floor( ( dur + release ) * SR )
	);
	if ( n <= 0 ) {
		return;
	}
	const s0 = Math.floor( start * SR );
	let phase = 0;
	for ( let k = 0; k < n; k++ ) {
		const t = k / SR;
		let env;
		if ( t < attack ) {
			env = t / attack;
		} else if ( t < attack + decay ) {
			env = 1 - ( 1 - sustain ) * ( ( t - attack ) / decay );
		} else if ( t < dur ) {
			env = sustain;
		} else {
			env = sustain * Math.max( 0, 1 - ( t - dur ) / release );
		}
		const f =
			freq *
			( 1 +
				( vib && t > 0.12
					? vib * Math.sin( 2 * Math.PI * 5.6 * t )
					: 0 ) );
		phase += f / SR;
		const p = phase - Math.floor( phase );
		let v;
		if ( wave === 'pulse' ) {
			v = p < duty ? 1 : -1;
		} else if ( wave === 'tri' ) {
			v = 4 * Math.abs( p - 0.5 ) - 1;
		} else if ( wave === 'saw' ) {
			v = ( 2 * p - 1 ) * 0.8;
		} else if ( wave === 'sine' ) {
			v = Math.sin( 2 * Math.PI * p );
		} else if ( wave === 'organ' ) {
			v =
				( Math.sin( 2 * Math.PI * p ) +
					0.5 * Math.sin( 4 * Math.PI * p ) +
					0.3 * Math.sin( 6 * Math.PI * p ) +
					0.15 * Math.sin( 8 * Math.PI * p ) ) /
				1.6; // drawbars
		} else if ( wave === 'fm' ) {
			const index = 3.5 * Math.exp( -t * 4 ); // the bell of an electric piano: bright at the strike, pure as it rings
			v = Math.sin(
				2 * Math.PI * p + index * Math.sin( 2 * Math.PI * p * 2 )
			);
		} else if ( wave === 'strings' ) {
			const d = 0.004; // two sections a little apart, so the tone breathes
			v =
				( 2 * p -
					1 +
					( 2 * ( ( phase * ( 1 + d ) ) % 1 ) - 1 ) +
					( 2 * ( ( phase * ( 1 - d ) ) % 1 ) - 1 ) ) *
				0.28;
		} else {
			v = 0;
		}
		mix[ s0 + k ] += v * env * gain;
	}
}
/* Drums from a noise channel: a low thump, a bright crack, a tick. */
let seed = 1;
const rnd = () => ( seed = ( seed * 1664525 + 1013904223 ) >>> 0 ) / 4294967296;
function hit( mix, start, kind ) {
	const s0 = Math.floor( start * SR );
	const spec = {
		kick: [ 0.09, 0.5, 0.045 ],
		snare: [ 0.11, 0.35, 0.4 ],
		hat: [ 0.03, 0.14, 0.9 ],
	}[ kind ];
	const n = Math.min( mix.length - s0, Math.floor( spec[ 0 ] * SR ) );
	let lp = 0;
	for ( let k = 0; k < n; k++ ) {
		const env = Math.pow( 1 - k / n, 2.2 );
		const white = rnd() * 2 - 1;
		lp += ( white - lp ) * spec[ 2 ]; // a one-pole filter: low for the kick, open for the hat
		let v = lp;
		if ( kind === 'kick' ) {
			v +=
				0.9 *
				Math.sin( 2 * Math.PI * ( 110 - 70 * ( k / n ) ) * ( k / SR ) ); // the thump under the noise
		}
		mix[ s0 + k ] += v * env * spec[ 1 ];
	}
}

const DRUMS = {
	none: null,
	light: ( bar ) => [
		...bar( 'kick', [ 0, 2 ] ),
		...bar( 'snare', [ 1, 3 ] ),
		...bar( 'hat', [ 0.5, 1.5, 2.5, 3.5 ] ),
	],
	full: ( bar ) => [
		...bar( 'kick', [ 0, 1.5, 2 ] ),
		...bar( 'snare', [ 1, 3 ] ),
		...bar( 'hat', [ 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5 ] ),
	],
	march: ( bar ) => [
		...bar( 'kick', [ 0, 1, 2, 3 ] ),
		...bar( 'snare', [ 1.5, 3, 3.5 ] ),
		...bar( 'hat', [ 0.5, 2.5 ] ),
	],
	rag: ( bar ) => [
		...bar( 'kick', [ 0, 2 ] ),
		...bar( 'snare', [ 1, 3 ] ),
		...bar( 'hat', [ 0.5, 1.5, 2.5, 3.5 ] ),
	],
	habanera: ( bar ) => [
		...bar( 'kick', [ 0, 1.5, 2 ] ),
		...bar( 'hat', [ 1, 3 ] ),
		...bar( 'snare', [ 3 ] ),
	],
};

function render( song ) {
	const mix = new Float32Array( SR * ( LENGTH + 1 ) );
	const beat = 60 / song.bpm / ( song.eighths ? 1 : 1 ); // eighth-note songs already count eighths at their tempo
	const total = LENGTH;
	const arpStep = song.arp === 'fast' ? 0.25 : song.arp === 'slow' ? 1 : 0.5;
	const barLen = song.eighths ? 6 : 4;
	// melody, looped
	for ( let pass = 0, at = 0; at < total; pass++ ) {
		for ( const [ note, beats ] of song.melody ) {
			if ( at >= total ) {
				break;
			}
			if ( note !== '-' ) {
				voice(
					mix,
					at,
					beats * beat * 0.92,
					hz( note ),
					PRESETS[ song.lead ]
				); // the arrangement carries the variation between passes
			}
			at += beats * beat;
		}
	}
	// chords: triangle bass on the root, arpeggios on a soft narrow pulse; second pass adds a fifth in the bass
	for ( let pass = 0, at = 0; at < total; pass++ ) {
		for ( const [ name, beats ] of song.chords ) {
			if ( at >= total ) {
				break;
			}
			const notes = chordNotes( name );
			const root = notes[ 0 ];
			for ( let b = 0; b < beats; b += 1 ) {
				const t = at + b * beat;
				if ( t >= total ) {
					break;
				}
				const bassNote = pass >= 1 && b % 2 === 1 ? root + 7 : root;
				voice( mix, t, beat * 0.9, mhz( bassNote ), PRESETS.bass );
			}
			for ( let s = 0, k = 0; s < beats; s += arpStep, k++ ) {
				const t = at + s * beat;
				if ( t >= total ) {
					break;
				}
				const n =
					notes[ k % notes.length ] + 24 + ( pass >= 2 ? 12 : 0 );
				voice( mix, t, arpStep * beat * 0.8, mhz( n ), {
					...PRESETS.arp,
					gain: pass === 0 ? 0.05 : 0.07,
				} );
			}
			at += beats * beat;
		}
	}
	// drums, from the second bar so the tune states itself first
	const pattern = DRUMS[ song.drums ];
	if ( pattern ) {
		const bar = ( kind, beats ) => beats.map( ( b ) => [ kind, b ] );
		const perBar = pattern( bar );
		for (
			let barStart = barLen * beat;
			barStart < total;
			barStart += barLen * beat
		) {
			for ( const [ kind, b ] of perBar ) {
				if ( b < barLen && barStart + b * beat < total ) {
					hit( mix, barStart + b * beat, kind );
				}
			}
		}
	}
	// master: fade in and out, soft clip, normalise to -1 dBFS, exactly LENGTH seconds
	const out = new Int16Array( SR * LENGTH );
	let peak = 0;
	for ( let k = 0; k < out.length; k++ ) {
		peak = Math.max( peak, Math.abs( mix[ k ] ) );
	}
	const norm = 0.89 / ( peak || 1 );
	for ( let k = 0; k < out.length; k++ ) {
		const t = k / SR;
		const fade = Math.min( 1, t / 0.4, ( LENGTH - t ) / 1.6 );
		const v = Math.tanh( mix[ k ] * norm * 1.15 ) * fade;
		out[ k ] = Math.max(
			-32768,
			Math.min( 32767, Math.round( v * 32767 ) )
		);
	}
	return out;
}
function wav( pcm ) {
	const b = Buffer.alloc( 44 + pcm.length * 2 );
	b.write( 'RIFF', 0 );
	b.writeUInt32LE( 36 + pcm.length * 2, 4 );
	b.write( 'WAVE', 8 );
	b.write( 'fmt ', 12 );
	b.writeUInt32LE( 16, 16 );
	b.writeUInt16LE( 1, 20 );
	b.writeUInt16LE( 1, 22 );
	b.writeUInt32LE( SR, 24 );
	b.writeUInt32LE( SR * 2, 28 );
	b.writeUInt16LE( 2, 32 );
	b.writeUInt16LE( 16, 34 );
	b.write( 'data', 36 );
	b.writeUInt32LE( pcm.length * 2, 40 );
	Buffer.from( pcm.buffer ).copy( b, 44 );
	return b;
}

/* ---------------------------------------------------------------- files */
const run = ( cmd, args ) =>
	execFileSync( cmd, args, {
		stdio: [ 'ignore', 'pipe', 'ignore' ],
		maxBuffer: 1 << 28,
	} );
/* Same envelope the plugin measures on import (Fetcher::levels): mono 8-bit at 1 kHz, mean deviation per 100 samples, 9·sqrt(v/peak). */
function levels( file ) {
	const pcm = run( 'ffmpeg', [
		'-v',
		'error',
		'-i',
		file,
		'-ac',
		'1',
		'-ar',
		'1000',
		'-f',
		'u8',
		'-',
	] );
	const n = Math.floor( pcm.length / 100 );
	const v = [];
	let peak = 1;
	for ( let k = 0; k < n; k++ ) {
		let sum = 0;
		for ( let j = 0; j < 100; j++ ) {
			sum += Math.abs( pcm[ k * 100 + j ] - 128 );
		}
		v[ k ] = sum / 100;
		peak = Math.max( peak, v[ k ] );
	}
	return v
		.map( ( x ) => Math.min( 9, Math.round( 9 * Math.sqrt( x / peak ) ) ) )
		.join( '' );
}
function encode( src, out, offset, length, title, artist ) {
	run( 'ffmpeg', [
		'-v',
		'error',
		'-y',
		'-ss',
		String( offset ),
		'-t',
		String( length ),
		'-i',
		src,
		'-af',
		`afade=t=in:d=0.3,afade=t=out:st=${ length - 1 }:d=1`,
		'-ac',
		'1',
		'-ar',
		'32000',
		'-b:a',
		'64k',
		'-id3v2_version',
		'3',
		'-metadata',
		`title=${ title }`,
		'-metadata',
		`artist=${ artist }`,
		out,
	] );
	return Math.round(
		parseFloat(
			run( 'ffprobe', [
				'-v',
				'error',
				'-show_entries',
				'format=duration',
				'-of',
				'csv=p=0',
				out,
			] ).toString()
		)
	);
}
function clearMp3s( dir ) {
	for ( const f of fs.readdirSync( dir ) ) {
		if ( f.endsWith( '.mp3' ) ) {
			fs.unlinkSync( path.join( dir, f ) );
		}
	}
}
const writeJSON = ( file, data, pretty ) =>
	fs.writeFileSync(
		file,
		( pretty
			? JSON.stringify( data, null, '\t' )
			: JSON.stringify( data ) ) + '\n'
	);
const PERFORMER = 'Callboard 8-bit';
const SOURCE =
	'https://github.com/josephfusco/callboard/blob/main/tests/fixtures/chiptunes.js';

const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'callboard-chip-' ) );
const wavs = SONGS.map( ( s ) => {
	const file = path.join( tmp, `${ s.id }.wav` );
	fs.writeFileSync( file, wav( render( s ) ) );
	console.log( `rendered ${ s.title } (${ s.composer })` );
	return file;
} );

const demo = path.join( ROOT, 'demo-set' );
clearMp3s( demo );
const tracks = [];
const lv = {};
SONGS.forEach( ( s, k ) => {
	const file = `${ String( k + 1 ).padStart( 2, '0' ) } - ${ s.title } [${
		s.id
	}].mp3`;
	const out = path.join( demo, file );
	const duration = encode( wavs[ k ], out, 0, LENGTH, s.title, PERFORMER );
	lv[ s.id ] = levels( out );
	tracks.push( {
		index: k + 1,
		id: s.id,
		title: s.title,
		file,
		duration,
		url: SOURCE,
		uploader: PERFORMER,
		uploader_url: SOURCE,
		composer: s.composer,
	} );
} );
writeJSON(
	path.join( demo, 'manifest.json' ),
	{
		name: 'Demo Set',
		slug: 'demo-set',
		order: 0,
		playlist_url: '',
		curator: 'Public-domain melodies',
		curator_url: 'https://en.wikipedia.org/wiki/Public_domain_music',
		tracks,
	},
	true
);
writeJSON( path.join( demo, 'levels.json' ), lv );

for ( const [ slug, length, offsets ] of [
	[ 'long-set', 20, [ 0, 18, 10 ] ],
	[ 'one-track', 24, [ 8 ] ],
] ) {
	const dir = path.join( ROOT, slug );
	const manifest = JSON.parse(
		fs.readFileSync( path.join( dir, 'manifest.json' ), 'utf8' )
	);
	clearMp3s( dir );
	const levelsOut = {};
	manifest.tracks.forEach( ( t, k ) => {
		const offset =
			offsets[ Math.floor( k / SONGS.length ) % offsets.length ];
		const out = path.join( dir, t.file );
		t.duration = encode(
			wavs[ k % SONGS.length ],
			out,
			offset,
			length,
			t.title.replace( /^\d+\.\s*/, '' ).replace( /\s*\(.*\)$/, '' ),
			PERFORMER
		);
		t.url = SOURCE;
		t.uploader = PERFORMER;
		t.uploader_url = SOURCE;
		levelsOut[ t.id ] = levels( out );
	} );
	manifest.playlist_url = '';
	manifest.curator = 'Public-domain melodies';
	manifest.curator_url = 'https://en.wikipedia.org/wiki/Public_domain_music';
	writeJSON( path.join( dir, 'manifest.json' ), manifest, true );
	writeJSON( path.join( dir, 'levels.json' ), levelsOut );
	console.log(
		`${ slug }: ${ manifest.tracks.length } tracks, ${ length }s each`
	);
}
fs.rmSync( tmp, { recursive: true, force: true } );
console.log( 'done' );
