/* ============ TOPIC SKETCHES — minimalist ink figures on paper, one colour wash each ============
   Drawn in a 100×100 space and scaled. Every line is inked twice (a firm pass plus a faint, slightly
   shifted pencil pass) so it reads as a hand sketch. A seeded RNG keeps each sketch identical on every load. */
const VG = (() => {
  const PAPER = "#f3ecdf", INK = "#2a2420";
  const C = { red:"#c8452f", ochre:"#d9a13a", blue:"#4f7fb8", green:"#6f9446", rose:"#d9837a", grey:"#9a9084" };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  let ctx, r;
  const head = (cx, cy, rr) => `M${cx - rr} ${cy}a${rr} ${rr} 0 1 0 ${rr * 2} 0a${rr} ${rr} 0 1 0 ${-rr * 2} 0`;

  function ink(d, w = 1.4){
    const p = new Path2D(d);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = INK; ctx.globalAlpha = .9; ctx.lineWidth = w; ctx.stroke(p);
    ctx.save();                                   // faint pencil echo, slightly off
    ctx.translate((r() - .5) * 1.2, (r() - .5) * 1.2); ctx.rotate((r() - .5) * .012);
    ctx.globalAlpha = .3; ctx.lineWidth = w * .55; ctx.stroke(p);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function wash(d, color, a = .42){               // watercolour: two soft, offset layers
    const p = new Path2D(d);
    ctx.fillStyle = color;
    ctx.globalAlpha = a; ctx.fill(p);
    ctx.save(); ctx.translate((r() - .5) * 2.4, (r() - .5) * 2.4); ctx.globalAlpha = a * .45; ctx.fill(p); ctx.restore();
    ctx.globalAlpha = 1;
  }
  const star = (x, y, s = 2) => ink(`M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}`, 1);

  const SCENES = {
    yeu(){                                         // two people, face to face
      wash("M50 14c-3-4-9-2-7 3 1 3 7 7 7 7s6-4 7-7c2-5-4-7-7-3z", C.red, .7);
      ink("M50 14c-3-4-9-2-7 3 1 3 7 7 7 7s6-4 7-7c2-5-4-7-7-3z", 1.1);
      ink(head(35, 38, 9)); ink("M27 35c1-7 8-11 14-8");
      ink("M29 46c-4 5-11 9-15 18M41 46c2 5 5 9 6 16");
      ink(head(65, 37, 9)); ink("M57 33c2-8 13-9 16-2 2 5 1 12 4 20 2 5 5 8 8 10");
      ink("M59 45c-2 5-5 10-6 17M72 46c5 5 11 9 14 18");
      wash("M14 64c8-3 16-3 22-2 6 1 11 1 17 0 8-1 20-1 33 2V70H14Z", C.rose, .25);
    },
    ay(){                                          // two heads on one pillow, under a blanket
      wash("M18 44c0-6 32-8 64-4 4 1 4 9 0 10-32 2-62 2-64-6z", C.grey, .18);
      ink("M18 44c0-6 32-8 64-4 4 1 4 9 0 10-32 2-62 2-64-6z", 1.1);
      ink(head(39, 41, 8)); ink("M31 39c2-6 10-8 15-4");
      ink(head(60, 41, 8)); ink("M53 36c5-5 13-3 15 3M67 41c3 3 5 7 9 8");
      wash("M8 54c26-6 60-6 84 0v18c-26-5-58-5-84 0z", C.red, .38);
      ink("M8 54c26-6 60-6 84 0M8 54v18M92 54v18M8 72c26-5 58-5 84 0");
      ink("M30 58c6 3 10 8 12 13M58 57c-2 5-2 10 1 14", 1);
      star(20, 18, 1.8); star(80, 16, 2.2);
    },
    tien(){                                        // holding up a lì xì envelope
      wash("M60 8h15v20H60z", C.red, .75); ink("M60 8h15v20H60zM60 8l7.5 8 7.5-8", 1.2);
      ink(head(40, 26, 8)); ink("M33 22c3-5 11-6 14 0");
      ink("M31 38c5-3 13-3 18 0M49 38c4-4 8-9 12-14M31 38c-3 8-4 15-2 22");
      ink("M33 38c-1 12 0 22 1 34M47 38c1 12 0 22-1 34M40 52v20", 1.2);
      wash(head(72, 40, 2.6), C.ochre, .8); wash(head(66, 50, 2.2), C.ochre, .8); wash(head(74, 56, 1.9), C.ochre, .8);
      ink(head(72, 40, 2.6), .9); ink(head(66, 50, 2.2), .9); ink(head(74, 56, 1.9), .9);
    },
    nha(){                                         // parent and child, hand in hand
      wash(head(76, 18, 8), C.ochre, .5);
      ink(head(38, 22, 7)); ink("M32 19c2-5 10-6 13-1");
      ink("M33 30c-2 14-1 26 1 42M43 30c2 14 1 26-1 42M38 48v24", 1.3);
      ink("M33 32c-4 8-5 14-4 20M43 33c6 9 10 14 15 17");
      ink(head(62, 42, 5.5)); ink("M58 39c2-4 7-4 9-1");
      ink("M59 48c-1 8-1 16 0 24M65 48c1 8 1 16 0 24M58 50c0 0-1 0 0 0M65 50c3 5 4 9 4 12", 1.2);
      ink("M10 72h80", 1);
    },
    ban(){                                         // two friends clinking glasses
      wash("M43 30h8l-1 14h-6zM50 30h8l-2 14h-6z", C.ochre, .6);
      ink("M43 30h8l-1 14h-6zM50 30h8l-2 14h-6z", 1.1);
      ink("M50 18v5M44 20l2 4M56 20l-2 4", 1);
      ink(head(24, 32, 7)); ink("M18 29c2-5 9-6 12-1");
      ink("M20 39c-4 9-4 18 0 25M27 41c6 3 11 3 16-1");
      ink(head(76, 32, 7)); ink("M70 28c3-5 10-4 12 1 1 4 0 8 2 11");
      ink("M80 39c4 9 4 18 0 25M73 41c-6 3-11 3-16-1");
      ink("M16 64h68M32 64v12M68 64v12", 1.3);
    },
    doi(){                                         // hunched over a glowing phone
      wash(head(58, 50, 11), C.blue, .28);
      ink(head(46, 28, 8)); ink("M39 25c2-6 11-7 14 0");
      ink("M40 35c-8 7-11 18-9 35M52 35c3 6 3 11 1 15M31 70h24", 1.3);
      ink("M42 41c3 8 8 12 14 12M50 40c3 6 6 10 10 11");
      wash("M55 44l7 1-1 11-7-1z", C.blue, .7); ink("M55 44l7 1-1 11-7-1z", 1.1);
      ink("M66 14h18c2 0 3 1 3 3v7c0 2-1 3-3 3h-12l-4 4v-4h-2c-2 0-3-1-3-3v-7c0-2 1-3 3-3z", 1.1);
      ink("M71 20.5h.5M75 20.5h.5M79 20.5h.5", 2);
    },
    viec(){                                        // at the laptop, coffee on the side
      wash("M52 40l6 24H44z", C.blue, .3);
      ink("M52 40l6 24M40 64h22", 1.4);
      ink(head(28, 30, 8)); ink("M21 27c2-6 11-7 14-1");
      ink("M24 38c-4 9-4 18 0 26M31 39c5 9 11 16 19 22");
      ink("M12 66h76", 1.2); ink("M24 64l-4 12M20 76h12", 1.1);
      wash("M70 54h10v10c0 2-2 3-5 3s-5-1-5-3z", C.ochre, .55);
      ink("M70 54h10v10c0 2-2 3-5 3s-5-1-5-3zM80 57c3 0 3 5 0 5", 1.1);
      ink("M73 50c-2-3 2-4 0-7M77 50c-2-3 2-4 0-7", .9);
    },
    vui(){                                         // lifting phở noodles
      wash("M30 60c0 12 40 12 40 0z", C.ochre, .5);
      ink("M28 60h44M30 60c0 12 40 12 40 0M44 71v3h12v-3", 1.3);
      ink(head(50, 24, 8)); ink("M43 21c2-6 11-7 14 0");
      ink("M36 40c4-5 24-5 28 0M36 40c-3 6-4 12-3 16M64 40c3 3 4 6 2 10");
      ink("M58 52l8-20M61 53l9-19", 1.1);
      ink("M52 58c1-4 4-6 6-10M55 58c1-4 4-6 7-10M49 58c1-3 3-5 5-8", .9);
      ink("M38 54c-2-3 2-5 0-8M44 53c-2-3 2-5 0-8", .8);
    },
    triet(){                                       // the thinker under a crescent moon
      wash("M78 12a9 9 0 1 0 6 16 7 7 0 1 1-6-16z", C.ochre, .65);
      ink("M78 12a9 9 0 1 0 6 16 7 7 0 1 1-6-16z", 1.1);
      star(58, 14, 1.8); star(88, 42, 1.6);
      wash("M20 74c2-10 18-12 26-8 6-2 14 2 16 8z", C.grey, .3);
      ink("M20 74c2-10 18-12 26-8 6-2 14 2 16 8M16 74h52", 1.2);
      ink(head(40, 30, 7.5)); ink("M34 27c2-5 10-6 13-1");
      ink("M35 37c-6 8-7 18-3 26M44 37c3 2 5 4 6 6");
      ink("M32 63c8-2 16-4 22-2M54 61c0 5 0 9 2 13M34 63c6 2 12 2 18 1");
      ink("M50 60c2-6 2-12-2-17 0 0-3-1-5 0", 1.3);
    },
  };

  const cache = {};
  return function paint(id, W = 320, H = 320){
    const key = id + W + "x" + H;
    if(cache[key]) return cache[key];
    try{
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      ctx = c.getContext("2d"); if(!ctx) return "";
      r = rng(hash(id));
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
      ctx.scale(W / 100, H / 100);
      for(let i = 0; i < 500; i++){ ctx.fillStyle = r() < .5 ? "rgba(42,36,32,.035)" : "rgba(255,255,255,.35)"; ctx.fillRect(r() * 100, r() * 100, .5, .5); }
      ctx.translate(0, 4);                        // leave room for the name strip at the bottom
      ctx.translate(50, 44); ctx.scale(.86, .86); ctx.translate(-50, -44);
      (SCENES[id] || SCENES.triet)();
      return (cache[key] = c.toDataURL("image/png"));
    }catch(e){ return ""; }
  };
})();
