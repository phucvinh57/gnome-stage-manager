import React from 'react';
import {AbsoluteFill, Composition, Easing, interpolate, registerRoot, useCurrentFrame} from 'remotion';

const INK = '#182b2b';
const TEAL = '#257c71';
const DURATION = 270;
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const ramp = (frame, start, end) => interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease,
});
const mix = (a, b, t) => a + (b - a) * t;
const apps = [
    {name: 'Notes', color: '#ddae4f', symbol: '≡'},
    {name: 'Browser', color: '#588cdc', symbol: '◎'},
    {name: 'Files', color: '#69aabe', symbol: '▰'},
];

const Badge = ({id, size = 38}) => <div style={{width: size, height: size, borderRadius: size * .26,
    background: apps[id].color, color: '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: size * .72, fontWeight: 700,
    boxShadow: '0 3px 8px #0003'}}>{apps[id].symbol}</div>;

function Notes() {
    return <div style={{display: 'flex', height: 609, background: '#fffdf8'}}>
        <div style={{width: 245, background: '#eeeae0', padding: 30, color: '#6b726b', fontSize: 18}}>
            <div style={{fontSize: 13, letterSpacing: 2, marginBottom: 24}}>YOUR NOTEBOOK</div>
            {['Today', 'Ideas', 'Reading list', 'Weekend plans'].map((name, i) => <div key={name}
                style={{padding: '15px 18px', marginBottom: 8, borderRadius: 9,
                    background: i === 0 ? '#fffdf8' : 'transparent', color: i === 0 ? INK : undefined}}>{name}</div>)}
            <div style={{marginTop: 240, fontSize: 14}}>A little room to think.</div>
        </div>
        <div style={{padding: '55px 65px', flex: 1}}>
            <div style={{color: TEAL, letterSpacing: 3, fontSize: 14}}>MONDAY / A FRESH START</div>
            <div style={{fontSize: 53, fontWeight: 650, letterSpacing: -2, marginTop: 20}}>Plan a quieter day.</div>
            <div style={{fontSize: 22, color: '#77817c', marginTop: 18}}>Make space for the work that matters.</div>
            {['Sketch the next idea', 'Find a little inspiration', 'Bring everything together'].map((label, i) => <div
                key={label} style={{display: 'flex', gap: 19, alignItems: 'center', fontSize: 23,
                    borderBottom: '1px solid #e7e8df', padding: '26px 0'}}>
                <span style={{height: 23, width: 23, borderRadius: 6, border: `2px solid ${i === 0 ? TEAL : '#c7cec6'}`,
                    background: i === 0 ? TEAL : 'transparent', color: 'white', fontSize: 18, textAlign: 'center'}}>{i === 0 ? '✓' : ''}</span>{label}
            </div>)}
        </div>
    </div>;
}

function Browser() {
    return <div style={{background: '#f1f3e9', height: 609}}>
        <div style={{height: 50, background: '#f6f6f6', padding: '8px 160px', boxSizing: 'border-box'}}>
            <div style={{background: '#e8e9e9', borderRadius: 20, padding: 8, textAlign: 'center', color: '#707b77', fontSize: 15}}>⌕ &nbsp; fieldnotes.example / inspiration</div>
        </div>
        <div style={{padding: '25px 55px', display: 'flex', justifyContent: 'space-between', fontSize: 18}}>
            <strong>FIELDNOTES</strong><span>Places &nbsp; / &nbsp; Perspectives &nbsp; / &nbsp; About</span>
        </div>
        <div style={{display: 'flex', padding: '20px 55px', gap: 50}}>
            <div style={{width: 455, paddingTop: 35}}>
                <div style={{fontSize: 13, letterSpacing: 3, color: TEAL}}>A DIFFERENT PERSPECTIVE</div>
                <div style={{fontFamily: 'Georgia, serif', fontSize: 70, lineHeight: 1.05, marginTop: 20}}>Good ideas<br/>need space.</div>
                <div style={{fontSize: 22, color: '#67776b', lineHeight: 1.6, marginTop: 23}}>Step back. Look around.<br/>Find your next spark.</div>
                <div style={{background: INK, color: 'white', borderRadius: 30, padding: '14px 24px', fontSize: 17, display: 'inline-block', marginTop: 25}}>Explore the collection ↗</div>
            </div>
            <div style={{width: 595, height: 405, borderRadius: '110px 110px 12px 12px', overflow: 'hidden',
                position: 'relative', background: 'linear-gradient(165deg, #afd4cd, #e7e8bc 70%)'}}>
                <div style={{position: 'absolute', width: 95, height: 95, borderRadius: '50%', background: '#fff6cf', top: 43, right: 90}}/>
                {[['#6c9a88', 50, -110, -19], ['#386c61', 130, 70, 16], ['#1f4d48', 210, -100, -10]].map(([c, y, x, r]) => <div
                    key={c} style={{position: 'absolute', background: c, top: y, left: x, width: 850, height: 500,
                        borderRadius: '50% 50% 0 0', transform: `rotate(${r}deg)`}}/>)}
                <div style={{position: 'absolute', bottom: 22, left: 25, color: '#f6f6da', fontSize: 13, letterSpacing: 3}}>ROOM TO WANDER</div>
            </div>
        </div>
    </div>;
}

function Files() {
    return <div style={{height: 609, background: '#fafafa', display: 'flex'}}>
        <div style={{background: '#e9e9ec', padding: '30px 20px', width: 235, fontSize: 19}}>
            {['⌂  Home', '◷  Recent', '☆  Starred', '▤  Documents', '↓  Downloads', '▧  Pictures'].map((s, i) => <div key={s}
                style={{padding: 17, borderRadius: 8, marginBottom: 7, background: i === 3 ? '#d4e3ee' : 'transparent'}}>{s}</div>)}
        </div>
        <div style={{flex: 1, padding: '32px 42px'}}>
            <div style={{fontSize: 18, color: '#64727c', marginBottom: 35}}>Home &nbsp; / &nbsp; Documents &nbsp; / &nbsp; My next idea</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '42px 32px'}}>
                {['Inspiration', 'Sketches', 'References', 'Project notes', 'Reading list', 'Weekend plans'].map((name, i) => <div key={name} style={{textAlign: 'center'}}>
                    <div style={{width: 117, height: 87, background: i < 3 ? '#7db3cd' : '#fff', border: i < 3 ? '0' : '1px solid #ccd5d9',
                        borderRadius: 8, margin: '12px auto 18px', boxShadow: '0 4px 0 #0001', position: 'relative'}}>
                        {i < 3 ? <div style={{position: 'absolute', top: -10, width: 48, height: 15, borderRadius: '6px 6px 0 0', background: '#7db3cd'}}/>
                            : <div style={{padding: 19, color: '#a9bac1', fontSize: 26, lineHeight: .6}}>≡<br/>≡</div>}
                    </div><div style={{fontSize: 18}}>{name}</div>
                </div>)}
            </div>
        </div>
    </div>;
}

function AppWindow({id, rect, shear, z}) {
    return <div style={{position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
        zIndex: z, transform: `skewY(${shear}deg)`, transformOrigin: 'center', borderRadius: rect.w < 400 ? 7 : 13,
        boxShadow: rect.w < 400 ? '0 9px 16px #130c2633' : '0 16px 45px #170c353d'}}>
        <div style={{width: '100%', height: '100%', overflow: 'hidden', borderRadius: 'inherit'}}>
            <div style={{width: 1260, height: 665, transformOrigin: 'top left', transform: `scale(${rect.w / 1260}, ${rect.h / 665})`}}>
                <div style={{height: 56, background: id === 0 ? '#e5e2da' : '#e4e4e8', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '0 20px', fontSize: 18, fontWeight: 600}}>
                    <span style={{width: 90}}>☰</span><span>{apps[id].name}{id === 0 ? ' — Today' : id === 2 ? ' — My next idea' : ''}</span>
                    <span style={{fontSize: 15, background: '#d2d2d4', borderRadius: 18, width: 25, height: 25, textAlign: 'center', lineHeight: '25px'}}>×</span>
                </div>
                {id === 0 ? <Notes/> : id === 1 ? <Browser/> : <Files/>}
            </div>
        </div>
        <div style={{position: 'absolute', left: 9, bottom: -12, opacity: ramp(400 - rect.w, 0, 130)}}><Badge id={id} size={30}/></div>
    </div>;
}

const initial = [
    {x: 75, y: 80, w: 1030, h: 544},
    {x: 520, y: 130, w: 1000, h: 528},
    {x: 335, y: 190, w: 950, h: 501},
];
function arranged(id, active) {
    if (id === active) return {x: 28, y: 60, w: 1260, h: 665, shear: 0};
    const index = [0, 1, 2].filter(i => i !== active).indexOf(id);
    return {x: 1335, y: 240 + index * 166, w: 224 - index * 9, h: 126 - index * 5,
        shear: index === 0 ? 6 : -6};
}
const blend = (a, b, t) => Object.fromEntries(['x', 'y', 'w', 'h', 'shear'].map(k => [k, mix(a[k] || 0, b[k] || 0, t)]));
function geometry(id, frame) {
    let rect = {...initial[id], shear: 0};
    for (const [start, end, active] of [[45, 75, 0], [165, 190, 1]]) {
        rect = blend(rect, arranged(id, active), ramp(frame, start, end));
    }
    return rect;
}

function Pointer({frame}) {
    const points = [[0, 1480, 22], [85, 1480, 22], [140, 1425, 300], [200, 1425, 300]];
    const x = interpolate(frame, points.map(p => p[0]), points.map(p => p[1]), {extrapolateRight: 'clamp', easing: ease});
    const y = interpolate(frame, points.map(p => p[0]), points.map(p => p[2]), {extrapolateRight: 'clamp', easing: ease});
    const click = [45, 165].reduce((v, f) => Math.max(v, Math.max(0, 1 - Math.abs(frame - f) / 14)), 0);
    return <div style={{position: 'absolute', left: x, top: y, zIndex: 30, opacity: 1 - ramp(frame, 200, 212)}}>
        <div style={{position: 'absolute', left: -22, top: -22, width: 48, height: 48, borderRadius: '50%',
            background: '#a5ffde88', border: '2px solid #e0fff1', transform: `scale(${1.7 - click * .7})`, opacity: click}}/>
        <svg width="29" height="36" viewBox="0 0 29 36" style={{filter: 'drop-shadow(0 2px 2px #0006)', position: 'relative'}}>
            <path d="M3 2 L24 22 L14 23 L10 33 Z" fill="white" stroke="#20312d" strokeWidth="2"/>
        </svg>
    </div>;
}

const chapters = [
    {start: 0, end: 140, title: 'One window. Your full attention.', sub: 'Turn on Stage Manager to clear the clutter.'},
    {start: 140, end: DURATION + 10, title: 'Switch tasks with a click.', sub: 'Choose a preview. Get back to work.'},
];

function Demo() {
    const frame = useCurrentFrame();
    const active = frame < 165 ? 0 : 1;
    return <AbsoluteFill style={{background: '#f3f1e9', color: INK, fontFamily: 'Ubuntu, Arial, sans-serif'}}>
        <div style={{position: 'absolute', top: 40, left: 86, display: 'flex', alignItems: 'center', gap: 14, fontSize: 23, fontWeight: 600}}>
            <div style={{display: 'flex', gap: 4, alignItems: 'center', height: 28}}><span style={{width: 8, height: 18, background: TEAL, borderRadius: 2}}/><span style={{width: 20, height: 28, background: TEAL, borderRadius: 3}}/></div>
            Stage Manager <span style={{color: '#8a938a', fontWeight: 400, marginLeft: 9}}>for GNOME</span>
        </div>
        <div style={{position: 'absolute', right: 86, top: 46, color: '#7e887f', fontSize: 16, letterSpacing: 2}}>LESS CLUTTER. MORE FOCUS.</div>
        {chapters.map(c => {
            const visible = ramp(frame, c.start, c.start + 12) * (1 - ramp(frame, c.end - 10, c.end));
            return <div key={c.start} style={{position: 'absolute', left: 160, top: 106, opacity: visible,
                transform: `translateY(${(1 - ramp(frame, c.start, c.start + 18)) * 12}px)`}}>
                <div style={{fontSize: 58, letterSpacing: -2, fontWeight: 600, lineHeight: 1.2}}>{c.title}</div>
                <div style={{fontSize: 23, color: '#68766e', marginTop: 14}}>{c.sub}</div>
            </div>;
        })}
        <div style={{position: 'absolute', left: 160, top: 240, width: 1600, height: 750, borderRadius: 20,
            overflow: 'hidden', background: 'radial-gradient(ellipse at 85% 100%, #db947c 0%, transparent 55%), radial-gradient(ellipse at 15% 100%, #b496c7 0%, transparent 55%), linear-gradient(120deg, #302843, #6c5074)',
            boxShadow: '0 24px 65px #29392f26', border: '1px solid #ffffff88'}}>
            <div style={{height: 36, background: '#18191d', color: '#f2f1f5', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '0 22px', fontSize: 14, fontWeight: 500}}>
                <span>Activities &nbsp; ••</span><span>Mon 10:24</span>
                <span style={{display: 'flex', alignItems: 'center', gap: 16}}>
                    <span style={{padding: '2px 12px', borderRadius: 20, background: frame >= 45 ? '#4b786e' : '#45454c'}}>▥</span>◉ &nbsp; ▴ &nbsp; ▰
                </span>
            </div>
            {[0, 1, 2].map(id => <AppWindow key={id} id={id} rect={geometry(id, frame)} shear={geometry(id, frame).shear} z={id === active ? 10 : id + 1}/>)}
            <Pointer frame={frame}/>

        </div>
        <div style={{position: 'absolute', top: 1021, left: 160, fontSize: 15, color: '#7e887f', letterSpacing: 1}}>ANIMATED WALKTHROUGH · EXPERIMENTAL EXTENSION</div>
        <div style={{position: 'absolute', top: 1020, right: 160, fontSize: 16, color: TEAL}}>Primary monitor · Current workspace</div>
        <div style={{position: 'absolute', bottom: 0, left: 0, height: 4, width: `${frame / (DURATION - 1) * 100}%`, background: TEAL}}/>
    </AbsoluteFill>;
}

registerRoot(() => <Composition id="StageManager" component={Demo} width={1920} height={1080} fps={30} durationInFrames={DURATION}/>);
