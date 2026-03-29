/* ============================================================
   3D FLAG EXPLORER — Premium D3.js Map Engine
   Natural Earth projection · Rich gradients · Multi-atmosphere
   RAF tooltip · Throttled sidebar · Zero DOM reordering
   ============================================================ */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────── */
  var svg, mapG, pathGen, proj, zoomB, meshData, hlOverlay;
  var allFeatures = [], countryList = [];
  var activeContinent = 'world', activeLetter = 'all';
  var activeNode = null, hoveredNode = null, searchTimer = null;
  var W, H;

  /* Performance: RAF-throttled tooltip positioning */
  var tipRAF = 0, tipX = 0, tipY = 0;
  var lastHoveredFeature = null;  /* track to skip redundant updates */
  var tipVisible = false;         /* true state for tooltip */
  var leaveTimer = null;          /* debounce hover-leave for gap crossings */

  var q = function (s) { return document.querySelector(s); };
  var qa = function (s) { return [].slice.call(document.querySelectorAll(s)); };

  var el = {};
  function cacheDom() {
    el.loader       = q('#loader');
    el.app          = q('#app');
    el.mapDiv       = q('#map-container');
    el.tip          = q('#map-tooltip');
    el.tipFlag      = q('#tooltip-flag');
    el.tipName      = q('#tooltip-name');
    el.tipCont      = q('#tooltip-cont');
    el.search       = q('#search-input');
    el.searchDrop   = q('#search-results');
    el.countryList  = q('#country-list');
    el.alphaBar     = q('#alphabet-filter');
    el.countNum     = q('#country-count-num');
    el.sidebarCount = q('#sidebar-count');
    el.panel        = q('#flag-panel');
    el.panelBg      = q('#flag-panel-backdrop');
    el.panelClose   = q('#flag-panel-close');
    el.panelImg     = q('#flag-image');
    el.panelName    = q('#flag-country-name');
    el.panelBadge   = q('#flag-continent-badge');
    el.neighbors    = q('#neighbor-flags');
    el.neighborsWrap= q('#flag-neighbors');
    el.sidebar      = q('#sidebar');
    el.sideToggle   = q('#sidebar-toggle');
    el.sideReopen   = q('#sidebar-reopen');
    el.reset        = q('#reset-btn');
    el.zoomIn       = q('#zoom-in');
    el.zoomOut      = q('#zoom-out');
    el.zoomSlider   = q('#zoom-slider');
    el.zoomLevel    = q('#map-zoom-level');
  }

  /* ── TopoJSON numeric ID → country name ────────────────── */
  var ID_MAP = {
    '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola',
    '010':'Antarctica','032':'Argentina','051':'Armenia','036':'Australia',
    '040':'Austria','031':'Azerbaijan','044':'Bahamas','050':'Bangladesh',
    '112':'Belarus','056':'Belgium','084':'Belize','204':'Benin',
    '064':'Bhutan','068':'Bolivia','070':'Bosnia and Herz.','072':'Botswana',
    '076':'Brazil','096':'Brunei','100':'Bulgaria','854':'Burkina Faso',
    '108':'Burundi','116':'Cambodia','120':'Cameroon','124':'Canada',
    '140':'Central African Rep.','148':'Chad','152':'Chile','156':'China',
    '170':'Colombia','178':'Congo','180':'Dem. Rep. Congo','188':'Costa Rica',
    '384':"Côte d'Ivoire",'191':'Croatia','192':'Cuba','196':'Cyprus',
    '203':'Czechia','208':'Denmark','262':'Djibouti','214':'Dominican Rep.',
    '218':'Ecuador','818':'Egypt','222':'El Salvador','226':'Eq. Guinea',
    '232':'Eritrea','233':'Estonia','748':'eSwatini','231':'Ethiopia',
    '238':'Falkland Is.','242':'Fiji','246':'Finland','250':'France',
    '260':'Fr. S. Antarctic Lands','266':'Gabon','270':'Gambia','268':'Georgia',
    '276':'Germany','288':'Ghana','300':'Greece','304':'Greenland',
    '320':'Guatemala','324':'Guinea','624':'Guinea-Bissau','328':'Guyana',
    '332':'Haiti','340':'Honduras','348':'Hungary','352':'Iceland',
    '356':'India','360':'Indonesia','364':'Iran','368':'Iraq',
    '372':'Ireland','376':'Israel','380':'Italy','388':'Jamaica',
    '392':'Japan','400':'Jordan','398':'Kazakhstan','404':'Kenya',
    '408':'North Korea','410':'South Korea','-99':'Kosovo',
    '414':'Kuwait','417':'Kyrgyzstan','418':'Laos','428':'Latvia',
    '422':'Lebanon','426':'Lesotho','430':'Liberia','434':'Libya',
    '440':'Lithuania','442':'Luxembourg','450':'Madagascar','454':'Malawi',
    '458':'Malaysia','466':'Mali','478':'Mauritania','484':'Mexico',
    '498':'Moldova','496':'Mongolia','499':'Montenegro','504':'Morocco',
    '508':'Mozambique','104':'Myanmar','516':'Namibia','524':'Nepal',
    '528':'Netherlands','540':'New Caledonia','554':'New Zealand',
    '558':'Nicaragua','562':'Niger','566':'Nigeria','807':'North Macedonia',
    '578':'Norway','512':'Oman','586':'Pakistan','275':'Palestine',
    '591':'Panama','598':'Papua New Guinea','600':'Paraguay','604':'Peru',
    '608':'Philippines','616':'Poland','620':'Portugal','630':'Puerto Rico',
    '634':'Qatar','642':'Romania','643':'Russia','646':'Rwanda',
    '682':'Saudi Arabia','686':'Senegal','688':'Serbia','694':'Sierra Leone',
    '703':'Slovakia','705':'Slovenia','090':'Solomon Is.','706':'Somalia',
    '710':'South Africa','728':'S. Sudan','724':'Spain','144':'Sri Lanka',
    '729':'Sudan','740':'Suriname','752':'Sweden','756':'Switzerland',
    '760':'Syria','158':'Taiwan','762':'Tajikistan','834':'Tanzania',
    '764':'Thailand','626':'Timor-Leste','768':'Togo','780':'Trinidad and Tobago',
    '788':'Tunisia','792':'Turkey','795':'Turkmenistan','800':'Uganda',
    '804':'Ukraine','784':'United Arab Emirates','826':'United Kingdom',
    '840':'United States of America','858':'Uruguay','860':'Uzbekistan',
    '548':'Vanuatu','862':'Venezuela','704':'Vietnam',
    '732':'W. Sahara','887':'Yemen','894':'Zambia','716':'Zimbabwe'
  };

  /* ── Boot ───────────────────────────────────────────────── */
  async function boot() {
    cacheDom();
    try {
      var res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
      var topo = await res.json();
      var geo = topojson.feature(topo, topo.objects.countries);
      meshData = topojson.mesh(topo, topo.objects.countries, function (a, b) { return a !== b; });
      enrichFeatures(geo.features);
      allFeatures = geo.features;
      countryList = buildFullCountryList();

      el.app.style.visibility = 'hidden';
      el.app.classList.remove('hidden');

      createMap();
      buildAlphabet();
      renderList();
      wireSearch();
      wireContinents();
      wirePanel();
      wireSidebar();
      wireZoom();
      wireKeys();

      el.countNum.textContent = countryList.length;
      el.sidebarCount.textContent = countryList.length;

      el.app.classList.add('hidden');
      el.app.style.visibility = '';

      setTimeout(function () {
        el.loader.classList.add('hidden');
        el.app.classList.remove('hidden');
      }, 800);
    } catch (err) {
      console.error('Boot error:', err);
      el.loader.querySelector('.loader-title').textContent = 'Load Error';
      el.loader.querySelector('.loader-sub').textContent = 'Check connection and reload.';
    }
  }

  function enrichFeatures(features) {
    features.forEach(function (f) {
      var id = String(f.id);
      var tryName = (f.properties && f.properties.name) || ID_MAP[id] || ID_MAP[id.padStart(3, '0')];
      if (!f.properties) f.properties = {};
      if (tryName) f.properties.name = tryName;
      f.properties._cd = tryName ? COUNTRIES_DATA[tryName] : null;
    });
  }

  /* ── Create Map ────────────────────────────────────────── */
  function createMap() {
    var rect = el.mapDiv.getBoundingClientRect();
    W = rect.width;
    H = rect.height;

    proj = d3.geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' });
    pathGen = d3.geoPath(proj);

    svg = d3.select(el.mapDiv).append('svg')
      .attr('class', 'map-svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    buildDefs(svg);

    mapG = svg.append('g').attr('class', 'map-g');

    /* ── Render order (back to front) ── */

    // 1. Ocean sphere
    mapG.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'sphere')
      .attr('d', pathGen)
      .attr('fill', 'url(#ocean-grad)');

    // 2. Inner shadow on sphere for depth
    mapG.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'sphere-shadow')
      .attr('d', pathGen)
      .attr('fill', 'url(#sphere-shadow-grad)');

    // 3. Multi-layer atmosphere (outer → inner)
    mapG.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'atmo-outer')
      .attr('d', pathGen);

    mapG.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'atmo-mid')
      .attr('d', pathGen);

    mapG.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'atmosphere')
      .attr('d', pathGen);

    // 4. Graticule
    mapG.append('path')
      .datum(d3.geoGraticule10())
      .attr('class', 'graticule')
      .attr('d', pathGen);

    // 5. Countries
    var countriesG = mapG.append('g').attr('class', 'countries-g');
    countriesG.selectAll('.land')
      .data(allFeatures)
      .enter().append('path')
      .attr('class', 'land')
      .attr('d', pathGen)
      .on('mouseenter', onHover)
      .on('mouseleave', onLeave)
      .on('mousemove', onMove)
      .on('click', onClick);

    // 6. Border mesh
    mapG.append('path')
      .datum(meshData)
      .attr('class', 'borders')
      .attr('d', pathGen);

    // 7. Sphere outline ring
    mapG.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'sphere-ring')
      .attr('d', pathGen);

    // 8. Highlight overlay — single reusable path, always on top
    //    Uses opacity transitions instead of display:none for smoothness
    hlOverlay = mapG.append('path')
      .attr('class', 'land hovered')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    // Zoom — premium feel with extended range
    zoomB = d3.zoom()
      .scaleExtent([1, 12])
      .on('zoom', onZoomed);

    svg.call(zoomB);
    svg.on('dblclick.zoom', null);

    window.addEventListener('resize', onResize);
  }

  /* ── SVG Definitions — Rich premium gradients ──────────── */
  function buildDefs(svgEl) {
    var defs = svgEl.append('defs');

    // Ocean — deep cinematic blue with off-center light source
    var og = defs.append('radialGradient').attr('id', 'ocean-grad')
      .attr('cx', '38%').attr('cy', '32%').attr('r', '68%');
    og.append('stop').attr('offset', '0%').attr('stop-color', '#1e6090');
    og.append('stop').attr('offset', '18%').attr('stop-color', '#185278');
    og.append('stop').attr('offset', '40%').attr('stop-color', '#103d5c');
    og.append('stop').attr('offset', '65%').attr('stop-color', '#092840');
    og.append('stop').attr('offset', '100%').attr('stop-color', '#040e1c');

    // Sphere inner shadow — deep 3D curvature
    var sg = defs.append('radialGradient').attr('id', 'sphere-shadow-grad')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    sg.append('stop').attr('offset', '0%').attr('stop-color', 'transparent');
    sg.append('stop').attr('offset', '55%').attr('stop-color', 'transparent');
    sg.append('stop').attr('offset', '80%').attr('stop-color', 'rgba(0,0,0,0.18)');
    sg.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.40)');

    // Country fill — vivid emerald with rich 3D lit shading
    var lg = defs.append('linearGradient').attr('id', 'land-grad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0.15').attr('y2', '1');
    lg.append('stop').attr('offset', '0%').attr('stop-color', '#4aedb5');
    lg.append('stop').attr('offset', '15%').attr('stop-color', '#22d89a');
    lg.append('stop').attr('offset', '40%').attr('stop-color', '#0ebb7c');
    lg.append('stop').attr('offset', '65%').attr('stop-color', '#069e65');
    lg.append('stop').attr('offset', '85%').attr('stop-color', '#058050');
    lg.append('stop').attr('offset', '100%').attr('stop-color', '#056d44');

    // Hover fill — electric crimson with lit depth
    var hg = defs.append('linearGradient').attr('id', 'hover-grad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0.15').attr('y2', '1');
    hg.append('stop').attr('offset', '0%').attr('stop-color', '#ff5c73');
    hg.append('stop').attr('offset', '20%').attr('stop-color', '#f43f5e');
    hg.append('stop').attr('offset', '50%').attr('stop-color', '#dc2626');
    hg.append('stop').attr('offset', '80%').attr('stop-color', '#b91c1c');
    hg.append('stop').attr('offset', '100%').attr('stop-color', '#881616');

    // Active fill — intense warm maroon
    var ag = defs.append('linearGradient').attr('id', 'active-grad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0.1').attr('y2', '1');
    ag.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444');
    ag.append('stop').attr('offset', '35%').attr('stop-color', '#dc2626');
    ag.append('stop').attr('offset', '70%').attr('stop-color', '#a31515');
    ag.append('stop').attr('offset', '100%').attr('stop-color', '#6b0000');

    // Dimmed country fill — dramatically darker for contrast
    var dg = defs.append('linearGradient').attr('id', 'land-dim-grad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    dg.append('stop').attr('offset', '0%').attr('stop-color', '#14805a');
    dg.append('stop').attr('offset', '50%').attr('stop-color', '#0a6040');
    dg.append('stop').attr('offset', '100%').attr('stop-color', '#054030');
  }

  /* ── Zoom handler ──────────────────────────────────────── */
  function onZoomed(event) {
    mapG.attr('transform', event.transform);
    var k = event.transform.k;
    el.zoomSlider.value = k;
    el.zoomLevel.textContent = k.toFixed(1) + '\u00d7';
  }

  /* ── Resize ────────────────────────────────────────────── */
  function onResize() {
    var r = el.mapDiv.getBoundingClientRect();
    W = r.width; H = r.height;
    proj.fitSize([W, H], { type: 'Sphere' });
    pathGen = d3.geoPath(proj);
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    mapG.selectAll('.sphere, .sphere-shadow, .atmosphere, .atmo-mid, .atmo-outer, .graticule, .land, .borders, .sphere-ring')
      .attr('d', function (d) { return d ? pathGen(d) : null; });
  }

  /* ── Hover — zero-lag country-to-country ────────────── */
  function onHover(event, d) {
    if (this === activeNode) return;
    var node = d3.select(this);
    if (node.classed('hidden-country')) return;
    var cd = d.properties._cd;
    var name = cd ? cd.display : d.properties.name;
    if (!name) return;

    // Cancel any pending leave — we're still on land
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }

    var wasHovering = hoveredNode !== null;
    hoveredNode = this;

    // Update overlay — instant swap, no transitions between countries
    hlOverlay.interrupt();
    hlOverlay.datum(d).attr('d', pathGen).style('opacity', 1);
    if (!wasHovering) {
      mapG.select('.countries-g').classed('has-hover', true);
    }

    // Update tooltip — only change content if different feature
    if (lastHoveredFeature !== d) {
      lastHoveredFeature = d;
      el.tipName.textContent = name;
      if (cd) {
        var flagSrc = getFlagPath(cd.flag);
        if (el.tipFlag.src !== flagSrc) el.tipFlag.src = flagSrc;
        el.tipFlag.style.display = 'block';
        el.tipCont.textContent = CONTINENTS[cd.continent] ? CONTINENTS[cd.continent].name : '';
      } else {
        el.tipFlag.style.display = 'none';
        el.tipCont.textContent = '';
      }
    }

    // Show tooltip instantly
    if (!tipVisible) {
      tipVisible = true;
      el.tip.style.opacity = '1';
      el.tip.style.transform = 'translate(-50%,calc(-100% - 16px)) scale(1)';
      el.tip.style.display = 'flex';
    }

    // Position via RAF
    tipX = event.clientX;
    tipY = event.clientY;
    scheduleTipUpdate();

    if (cd) hlSidebar(cd.display, true);
  }

  function onLeave(event, d) {
    if (this === activeNode) return;
    var node = d3.select(this);
    if (node.classed('hidden-country')) return;
    var cd = d.properties._cd;
    if (cd) hlSidebar(cd.display, false);

    // Debounce leave — prevents flicker when crossing tiny gaps between paths
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(function () {
      leaveTimer = null;
      if (hoveredNode) return; // re-entered a country already
      lastHoveredFeature = null;
      hlOverlay.interrupt().style('opacity', 0);
      mapG.select('.countries-g').classed('has-hover', false);
      tipVisible = false;
      el.tip.style.opacity = '0';
      el.tip.style.transform = 'translate(-50%,calc(-100% - 8px)) scale(0.96)';
    }, 40);

    hoveredNode = null;
  }

  function onMove(event) {
    tipX = event.clientX;
    tipY = event.clientY;
    scheduleTipUpdate();
  }

  /* RAF-throttled tooltip positioning — eliminates jank */
  function scheduleTipUpdate() {
    if (tipRAF) return;
    tipRAF = requestAnimationFrame(function () {
      el.tip.style.left = tipX + 'px';
      el.tip.style.top = tipY + 'px';
      tipRAF = 0;
    });
  }

  /* ── Click ─────────────────────────────────────────────── */
  function onClick(event, d) {
    var node = d3.select(this);
    if (node.classed('hidden-country')) return;
    var cd = d.properties._cd;
    if (!cd) return;

    if (activeNode && activeNode !== this) {
      d3.select(activeNode).classed('active', false);
    }
    activeNode = this;
    node.classed('active', true);
    hlOverlay.interrupt().style('opacity', 0);
    hoveredNode = null;
    lastHoveredFeature = null;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    mapG.select('.countries-g').classed('has-hover', false);
    tipVisible = false;
    el.tip.style.opacity = '0';

    openPanel(cd.display, cd.flag, cd.continent);

    // Fly to country bounds
    var b = pathGen.bounds(d);
    var bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
    if (bw < 1 || bh < 1) return;
    var cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
    var scale = Math.min(W / bw, H / bh, 10) * 0.65;
    smoothFlyTo(d3.zoomIdentity.translate(W / 2 - cx * scale, H / 2 - cy * scale).scale(scale));
  }

  /* ── Continent View ────────────────────────────────────── */
  function applyView(c) {
    activeNode = null;
    hoveredNode = null;
    lastHoveredFeature = null;
    hlOverlay.interrupt().style('opacity', 0);
    mapG.select('.countries-g').classed('has-hover', false);
    mapG.selectAll('.land')
      .classed('active', false)
      .classed('search-hl', false);

    if (c === 'world') {
      mapG.selectAll('.land').classed('hidden-country', false);
    } else {
      mapG.selectAll('.land').each(function (d) {
        var s = d3.select(this);
        var cd = d.properties._cd;
        s.classed('hidden-country', !(cd && cd.continent === c));
      });
    }
  }

  /* ── Smooth fly-to — prevents black blink on zoomed transitions ── */
  function smoothFlyTo(target, dur) {
    dur = dur || 800;
    var cur = d3.zoomTransform(svg.node());
    if (cur.k > 1.8) {
      // Already zoomed in — zoom out first to prevent black flash
      var outDur = Math.round(dur * 0.4);
      var inDur = dur - outDur;
      svg.transition().duration(outDur).ease(d3.easeCubicIn)
        .call(zoomB.transform, d3.zoomIdentity)
        .transition().duration(inDur).ease(d3.easeCubicOut)
        .call(zoomB.transform, target);
    } else {
      svg.transition().duration(dur).ease(d3.easeCubicInOut)
        .call(zoomB.transform, target);
    }
  }

  function flyToView(c) {
    if (c === 'world') {
      smoothFlyTo(d3.zoomIdentity, 800);
      return;
    }
    var cont = CONTINENTS[c];
    if (!cont || !cont.bounds) return;

    var b0 = cont.bounds[0];
    var b1 = cont.bounds[1];
    var corners = [
      proj([b0[0], b0[1]]),
      proj([b1[0], b0[1]]),
      proj([b1[0], b1[1]]),
      proj([b0[0], b1[1]])
    ].filter(function (p) { return p !== null; });
    if (corners.length < 2) return;

    var xs = corners.map(function (p) { return p[0]; });
    var ys = corners.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);

    var bw = x1 - x0, bh = y1 - y0;
    if (bw < 1 || bh < 1) return;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var scale = Math.min(W / bw, H / bh) * 0.82;
    smoothFlyTo(d3.zoomIdentity.translate(W / 2 - cx * scale, H / 2 - cy * scale).scale(scale));
  }

  function switchContinent(c) {
    applyView(c);
    // Stagger zoom so hide/show transitions settle first
    setTimeout(function () { flyToView(c); }, 80);
  }

  /* ── Continent Nav ─────────────────────────────────────── */
  function wireContinents() {
    qa('.continent-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = btn.dataset.continent;
        if (c === activeContinent) return;
        qa('.continent-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        activeContinent = c;
        renderList();
        switchContinent(c);
      });
    });
  }

  /* ── Navigate to Country ───────────────────────────────── */
  function navigateToCountry(c) {
    openPanel(c.name, c.flag, c.continent);
    if (!c.isOnMap || !c.topoName) return;

    if (activeContinent !== 'world' && c.continent !== activeContinent) {
      activeContinent = c.continent;
      qa('.continent-chip').forEach(function (b) { b.classList.remove('active'); });
      var chip = q('[data-continent="' + c.continent + '"]');
      if (chip) chip.classList.add('active');
      renderList();
      applyView(c.continent);
    }

    mapG.selectAll('.land').each(function (d) {
      if (d.properties.name === c.topoName ||
          (d.properties._cd && d.properties._cd.display === c.name)) {
        if (activeNode && activeNode !== this) {
          d3.select(activeNode).classed('active', false);
        }
        activeNode = this;
        d3.select(this).classed('active', true);
        hlOverlay.interrupt().style('opacity', 0);

        var b = pathGen.bounds(d);
        var bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
        if (bw < 1 || bh < 1) return;
        var cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
        var scale = Math.min(W / bw, H / bh, 10) * 0.65;
        smoothFlyTo(d3.zoomIdentity.translate(W / 2 - cx * scale, H / 2 - cy * scale).scale(scale));
      }
    });
  }

  /* ── Alphabet Filter ───────────────────────────────────── */
  function buildAlphabet() {
    var bar = el.alphaBar;
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (L) {
      var b = document.createElement('button');
      b.className = 'alpha-btn';
      b.dataset.letter = L;
      b.textContent = L;
      if (!countryList.some(function (c) { return c.name.toUpperCase().startsWith(L); }))
        b.classList.add('disabled');
      b.addEventListener('click', function () {
        if (b.classList.contains('disabled')) return;
        qa('.alpha-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        activeLetter = L;
        renderList();
      });
      bar.appendChild(b);
    });
    bar.querySelector('[data-letter="all"]').addEventListener('click', function () {
      qa('.alpha-btn').forEach(function (x) { x.classList.remove('active'); });
      bar.querySelector('[data-letter="all"]').classList.add('active');
      activeLetter = 'all';
      renderList();
    });
  }

  /* ── Sidebar Country List ──────────────────────────────── */
  function renderList() {
    var box = el.countryList;
    box.innerHTML = '';
    var items = countryList;
    if (activeContinent !== 'world')
      items = items.filter(function (c) { return c.continent === activeContinent; });
    if (activeLetter !== 'all')
      items = items.filter(function (c) { return c.name.toUpperCase().startsWith(activeLetter); });

    el.sidebarCount.textContent = items.length;

    if (!items.length) {
      box.innerHTML = '<div class="no-results"><p>No countries found</p></div>';
      return;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'country-card';
      card.dataset.name = c.name;

      var img = document.createElement('img');
      img.className = 'cc-flag';
      img.src = getFlagPath(c.flag);
      img.alt = c.name;
      img.loading = 'lazy';

      var info = document.createElement('div');
      info.className = 'cc-info';
      var n = document.createElement('div');
      n.className = 'cc-name';
      n.textContent = c.name;
      var ct = document.createElement('div');
      ct.className = 'cc-cont';
      ct.textContent = CONTINENTS[c.continent] ? CONTINENTS[c.continent].name : c.continent;
      info.appendChild(n);
      info.appendChild(ct);

      card.appendChild(img);
      card.appendChild(info);
      card.addEventListener('click', function () { navigateToCountry(c); });
      frag.appendChild(card);
    });
    box.appendChild(frag);
  }

  /* Sidebar highlight — lightweight: just toggle class, no forced scroll on hover */
  function hlSidebar(name, on) {
    var cards = el.countryList.querySelectorAll('.country-card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.name === name) {
        cards[i].classList.toggle('highlighted', on);
        break;
      }
    }
  }

  /* ── Search ────────────────────────────────────────────── */
  function wireSearch() {
    el.search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var v = el.search.value.trim().toLowerCase();
        if (v.length < 1) { el.searchDrop.classList.add('hidden'); clearHL(); return; }
        doSearch(v);
      }, 120);
    });
    el.search.addEventListener('focus', function () {
      var v = el.search.value.trim().toLowerCase();
      if (v.length >= 1) doSearch(v);
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-box')) el.searchDrop.classList.add('hidden');
    });
    el.search.addEventListener('keydown', function (e) {
      var items = el.searchDrop.querySelectorAll('.sr-item');
      var cur = el.searchDrop.querySelector('.sr-item.active');
      var idx = cur ? Array.from(items).indexOf(cur) : -1;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx < items.length - 1) {
          items.forEach(function (i) { i.classList.remove('active'); });
          items[idx + 1].classList.add('active');
          items[idx + 1].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) {
          items.forEach(function (i) { i.classList.remove('active'); });
          items[idx - 1].classList.add('active');
          items[idx - 1].scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (cur) cur.click(); else if (items[0]) items[0].click();
      } else if (e.key === 'Escape') {
        el.searchDrop.classList.add('hidden');
        el.search.blur();
      }
    });
  }

  function doSearch(query) {
    var matches = countryList.filter(function (c) {
      return c.name.toLowerCase().includes(query);
    }).slice(0, 12);
    var dd = el.searchDrop;
    dd.innerHTML = '';

    if (!matches.length) {
      dd.innerHTML = '<div class="no-results"><p>No matches</p></div>';
      dd.classList.remove('hidden');
      clearHL();
      return;
    }
    var frag = document.createDocumentFragment();
    matches.forEach(function (c, i) {
      var item = document.createElement('div');
      item.className = 'sr-item' + (i === 0 ? ' active' : '');

      var img = document.createElement('img');
      img.className = 'sr-flag';
      img.src = getFlagPath(c.flag);
      img.alt = c.name;

      var name = document.createElement('span');
      name.className = 'sr-name';
      name.textContent = c.name;

      var cont = document.createElement('span');
      cont.className = 'sr-cont';
      cont.textContent = CONTINENTS[c.continent] ? CONTINENTS[c.continent].name : '';

      item.appendChild(img);
      item.appendChild(name);
      item.appendChild(cont);
      item.addEventListener('click', function () {
        el.search.value = c.name;
        dd.classList.add('hidden');
        navigateToCountry(c);
      });
      item.addEventListener('mouseenter', function () {
        dd.querySelectorAll('.sr-item').forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');
      });
      frag.appendChild(item);
    });
    dd.appendChild(frag);
    dd.classList.remove('hidden');
    hlMap(matches);
  }

  function hlMap(matches) {
    clearHL();
    var names = new Set();
    matches.forEach(function (m) { names.add(m.name); if (m.topoName) names.add(m.topoName); });
    mapG.selectAll('.land').each(function (d) {
      var n = d.properties.name;
      var cd = d.properties._cd;
      if (names.has(n) || (cd && names.has(cd.display))) {
        d3.select(this).classed('search-hl', true);
      }
    });
    mapG.select('.borders').raise();
    mapG.select('.sphere-ring').raise();
    if (hlOverlay) hlOverlay.raise();
  }

  function clearHL() {
    mapG.selectAll('.land').classed('search-hl', false);
    if (activeNode) d3.select(activeNode).classed('active', true);
  }

  /* ── Flag Detail Panel ─────────────────────────────────── */
  function wirePanel() {
    el.panelClose.addEventListener('click', closePanel);
    el.panelBg.addEventListener('click', closePanel);
  }

  function openPanel(name, flag, continent) {
    el.panelImg.src = getFlagPath(flag);
    el.panelImg.alt = name + ' Flag';
    el.panelName.textContent = name;
    var ci = CONTINENTS[continent];
    el.panelBadge.textContent = ci ? ci.emoji + '  ' + ci.name : continent;
    renderNeighbors(name, continent);
    el.panel.classList.remove('hidden');
  }

  function closePanel() {
    el.panel.classList.add('hidden');
    if (activeNode) {
      d3.select(activeNode).classed('active', false);
    }
    activeNode = null;
  }

  function renderNeighbors(current, continent) {
    var box = el.neighbors;
    box.innerHTML = '';
    var nb = countryList.filter(function (c) {
      return c.continent === continent && c.name !== current;
    }).slice(0, 9);
    if (!nb.length) { el.neighborsWrap.style.display = 'none'; return; }
    el.neighborsWrap.style.display = '';
    nb.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'neighbor-card';
      var img = document.createElement('img');
      img.src = getFlagPath(c.flag);
      img.alt = c.name;
      img.loading = 'lazy';
      var span = document.createElement('span');
      span.textContent = c.name;
      card.appendChild(img);
      card.appendChild(span);
      card.addEventListener('click', function () { navigateToCountry(c); });
      box.appendChild(card);
    });
  }

  /* ── Sidebar Toggle ────────────────────────────────────── */
  function wireSidebar() {
    el.sideToggle.addEventListener('click', function () {
      el.sidebar.classList.add('collapsed');
      el.sideReopen.classList.remove('hidden');
    });
    el.sideReopen.addEventListener('click', function () {
      el.sidebar.classList.remove('collapsed');
      el.sideReopen.classList.add('hidden');
    });
  }

  /* ── Zoom Controls ─────────────────────────────────────── */
  function wireZoom() {
    el.zoomIn.addEventListener('click', function () {
      svg.transition().duration(350).ease(d3.easeCubicOut).call(zoomB.scaleBy, 1.4);
    });
    el.zoomOut.addEventListener('click', function () {
      svg.transition().duration(350).ease(d3.easeCubicOut).call(zoomB.scaleBy, 1 / 1.4);
    });
    el.zoomSlider.addEventListener('input', function () {
      var k = parseFloat(el.zoomSlider.value);
      svg.transition().duration(250).ease(d3.easeCubicOut).call(zoomB.scaleTo, k);
    });
    el.reset.addEventListener('click', resetView);
  }

  function resetView() {
    activeContinent = 'world';
    qa('.continent-chip').forEach(function (b) { b.classList.remove('active'); });
    qa('.continent-chip')[0].classList.add('active');
    activeLetter = 'all';
    qa('.alpha-btn').forEach(function (b) { b.classList.remove('active'); });
    el.alphaBar.querySelector('[data-letter="all"]').classList.add('active');
    applyView('world');
    smoothFlyTo(d3.zoomIdentity, 800);
    renderList();
    closePanel();
    clearHL();
    el.search.value = '';
  }

  /* ── Keyboard Shortcuts ────────────────────────────────── */
  function wireKeys() {
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); el.search.focus(); }
      if (e.key === 'Escape') {
        if (!el.panel.classList.contains('hidden')) closePanel();
        el.searchDrop.classList.add('hidden');
      }
    });
  }

  /* ── Start ─────────────────────────────────────────────── */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
