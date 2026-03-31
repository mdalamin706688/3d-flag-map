/* ============================================================
   3D FLAG EXPLORER — amCharts 5 Rotating Globe
   Orthographic projection · Continent rotation · Globe/Map toggle
   ============================================================ */

(function () {
  'use strict';

  // DOM references
  var el = {};
  function cacheDom() {
    el.search       = document.getElementById('search-input');
    el.searchDrop   = document.getElementById('search-results');
    el.countryList  = document.getElementById('country-list');
    el.countNum     = document.getElementById('country-count-num');
    el.sidebarCount = document.getElementById('sidebar-count');
    el.panel        = document.getElementById('flag-panel');
    el.panelClose   = document.getElementById('flag-panel-close');
    el.panelImg     = document.getElementById('flag-image');
    el.panelName    = document.getElementById('flag-country-name');
    el.panelBadge   = document.getElementById('flag-continent-badge');
    el.neighbors    = document.getElementById('neighbor-flags');
    el.contFilter   = document.getElementById('continent-filter');
  }

  var fullList = [];
  var activeContinent = 'all';
  var activeCountry = null;

  // Continent center coordinates for globe rotation
  var CONTINENT_CENTERS = {
    africa:       { lon: 20,   lat: 5    },
    asia:         { lon: 90,   lat: 35   },
    europe:       { lon: 15,   lat: 50   },
    northamerica: { lon: -100, lat: 40   },
    southamerica: { lon: -60,  lat: -15  },
    oceania:      { lon: 140,  lat: -25  }
  };

  function init() {
    cacheDom();
    fullList = buildFullCountryList();
    el.countNum.textContent = fullList.length;
    initGlobe();
    renderSidebar();
    bindEvents();
  }

  // ── amCharts 5 Globe ──
  var root, chart, polygonSeries, backgroundSeries;
  var previousPolygon;

  function initGlobe() {
    root = am5.Root.new("chartdiv");

    // Custom theme with maroon red accent
    var myTheme = am5.Theme.new(root);
    myTheme.rule("InterfaceColors").setAll({
      primaryButton: am5.color(0x800000),
      primaryButtonHover: am5.Color.lighten(am5.color(0x800000), 0.2),
      primaryButtonDown: am5.Color.lighten(am5.color(0x800000), -0.2),
      primaryButtonActive: am5.color(0xd9cec8),
    });

    root.setThemes([am5themes_Animated.new(root), myTheme]);

    chart = root.container.children.push(
      am5map.MapChart.new(root, {
        panX: "rotateX",
        panY: "rotateY",
        projection: am5map.geoOrthographic(),
        paddingBottom: 20,
        paddingTop: 20,
        paddingLeft: 20,
        paddingRight: 20
      })
    );

    // Globe/Map toggle switch
    var cont = chart.children.push(am5.Container.new(root, {
      layout: root.horizontalLayout,
      x: 20,
      y: 40
    }));

    cont.children.push(am5.Label.new(root, {
      centerY: am5.p50,
      text: "Globe"
    }));

    var switchButton = cont.children.push(am5.Button.new(root, {
      themeTags: ["switch"],
      centerY: am5.p50,
      icon: am5.Circle.new(root, {
        themeTags: ["icon"]
      })
    }));

    switchButton.on("active", function () {
      if (switchButton.get("active")) {
        chart.set("projection", am5map.geoMercator());
        chart.set("panY", "translateY");
        chart.animate({ key: "rotationY", to: 0, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
        chart.animate({ key: "rotationX", to: 0, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
        backgroundSeries.mapPolygons.template.set("fillOpacity", 0);
      } else {
        chart.set("projection", am5map.geoOrthographic());
        chart.set("panY", "rotateY");
        chart.animate({ key: "rotationY", to: -25, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
        chart.animate({ key: "rotationX", to: 0, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
        backgroundSeries.mapPolygons.template.set("fillOpacity", 0.1);
      }
    });

    cont.children.push(am5.Label.new(root, {
      centerY: am5.p50,
      text: "Map"
    }));

    // Country polygons
    polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_worldLow
      })
    );

    polygonSeries.mapPolygons.template.setAll({
      toggleKey: "active",
      interactive: true,
      cursorOverStyle: "pointer",
      fill: am5.color(0xd9d9d9),
      stroke: am5.color(0xffffff),
      strokeWidth: 0.75,
      strokeOpacity: 1
    });

    // Premium HTML tooltip with flag image
    var tooltip = am5.Tooltip.new(root, {
      getFillFromSprite: false,
      getLabelFillFromSprite: false,
      autoTextColor: false,
      labelHTML: "",
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0
    });
    tooltip.get("background").setAll({
      fill: am5.color(0xffffff),
      fillOpacity: 0,
      strokeWidth: 0
    });
    polygonSeries.mapPolygons.template.set("tooltip", tooltip);

    polygonSeries.mapPolygons.template.adapters.add("tooltipHTML", function(html, target) {
      if (target.dataItem) {
        var mapName = target.dataItem.dataContext.name;
        var cd = COUNTRIES_DATA[mapName];
        if (cd) {
          var flagSrc = encodeURI(getFlagPath(cd.flag));
          var contName = CONTINENTS[cd.continent] ? CONTINENTS[cd.continent].name : cd.continent;
          return '<div style="background:rgba(255,255,255,0.97);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.10);padding:14px 18px 12px;text-align:center;min-width:140px;backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,0.06)">' +
            '<img src="' + flagSrc + '" style="width:80px;height:auto;border-radius:6px;box-shadow:0 3px 12px rgba(0,0,0,0.15);margin:0 auto 10px;display:block;border:1px solid rgba(0,0,0,0.08)" />' +
            '<div style="font-size:14px;font-weight:700;color:#1a1a1a;letter-spacing:-0.01em;margin-bottom:4px">' + (cd.display || mapName) + '</div>' +
            '<div style="font-size:11px;font-weight:500;color:#fff;background:#800000;display:inline-block;padding:2px 10px;border-radius:10px;letter-spacing:0.03em">' + contName + '</div>' +
            '</div>';
        }
        return '<div style="background:rgba(255,255,255,0.97);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.15);padding:10px 16px;text-align:center;backdrop-filter:blur(8px)">' +
          '<div style="font-size:13px;font-weight:600;color:#1a1a1a">' + mapName + '</div></div>';
      }
      return "";
    });

    polygonSeries.mapPolygons.template.states.create("hover", {
      fill: am5.color(0x800000)
    });

    polygonSeries.mapPolygons.template.states.create("active", {
      fill: am5.color(0x800000)
    });

    // Background fill (ocean)
    backgroundSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {})
    );
    backgroundSeries.mapPolygons.template.setAll({
      fill: root.interfaceColors.get("alternativeBackground"),
      fillOpacity: 0.1,
      strokeOpacity: 0
    });
    backgroundSeries.data.push({
      geometry: am5map.getGeoRectangle(90, 180, -90, -180)
    });

    // Graticule
    var graticuleSeries = chart.series.unshift(
      am5map.GraticuleSeries.new(root, {
        step: 10
      })
    );
    graticuleSeries.mapLines.template.set("strokeOpacity", 0.1);

    // Active state event — rotate globe + show flag panel (for direct map clicks)
    polygonSeries.mapPolygons.template.on("active", function (active, target) {
      if (previousPolygon && previousPolygon !== target) {
        previousPolygon.set("active", false);
        previousPolygon.set("fill", am5.color(0xd9d9d9));
      }
      if (target.get("active")) {
        // Clear continent highlighting so selected country stands out
        clearContinentHighlight();
        target.set("fill", am5.color(0x800000));

        var id = target.dataItem.get("id");
        selectCountry(id);
        var mapName = target.dataItem.dataContext.name;
        var displayName = mapName;
        if (COUNTRIES_DATA[mapName] && COUNTRIES_DATA[mapName].display) {
          displayName = COUNTRIES_DATA[mapName].display;
        }
        showFlagPanel(mapName);
        highlightSidebarItem(displayName);
      } else {
        target.set("fill", am5.color(0xd9d9d9));
      }
      previousPolygon = target;
    });

    chart.appear(1000, 100);
    chart.animate({ key: "rotationY", to: -25, duration: 2500, easing: am5.ease.inOut(am5.ease.cubic) });
  }

  // Rotate globe to a continent center
  function rotateToContinentCenter(continentKey) {
    var center = CONTINENT_CENTERS[continentKey];
    if (!center) return;
    chart.animate({ key: "rotationX", to: -center.lon, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
    chart.animate({ key: "rotationY", to: -center.lat, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
  }

  // Build a set of map names belonging to a continent
  function getContinentCountryNames(continentKey) {
    var names = {};
    for (var key in COUNTRIES_DATA) {
      var c = COUNTRIES_DATA[key].continent;
      if (c === continentKey || (continentKey === 'northamerica' && (c === 'northamerica' || c === 'southamerica'))) {
        names[key] = true;
      }
    }
    return names;
  }

  // Highlight all countries in a continent on the map
  function highlightContinentOnMap(continentKey) {
    var names = getContinentCountryNames(continentKey);
    polygonSeries.mapPolygons.each(function (polygon) {
      if (polygon.dataItem) {
        var mapName = polygon.dataItem.dataContext.name;
        if (names[mapName]) {
          polygon.set("fill", am5.color(0x800000));
        } else {
          polygon.set("fill", am5.color(0xd9d9d9));
        }
      }
    });
  }

  // Clear continent highlight — reset all to default
  function clearContinentHighlight() {
    polygonSeries.mapPolygons.each(function (polygon) {
      polygon.set("fill", am5.color(0xd9d9d9));
    });
  }

  // Rotate globe to country by amCharts polygon ID
  function selectCountry(id) {
    var dataItem = polygonSeries.getDataItemById(id);
    var target = dataItem.get("mapPolygon");
    if (target) {
      var centroid = target.geoCentroid();
      if (centroid) {
        chart.animate({ key: "rotationX", to: -centroid.longitude, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
        chart.animate({ key: "rotationY", to: -centroid.latitude, duration: 1500, easing: am5.ease.inOut(am5.ease.cubic) });
      }
    }
  }

  // Rotate to country by name (called from sidebar/search)
  function rotateToCountryByName(name, topoName) {
    var found = null;

    // First try by topoName (map key) — most reliable
    if (topoName) {
      polygonSeries.mapPolygons.each(function (polygon) {
        if (!found && polygon.dataItem && polygon.dataItem.dataContext.name === topoName) {
          found = polygon;
        }
      });
    }

    // Then try by display name directly
    if (!found) {
      polygonSeries.mapPolygons.each(function (polygon) {
        if (!found && polygon.dataItem && polygon.dataItem.dataContext.name === name) {
          found = polygon;
        }
      });
    }

    // Fall back to alias lookup
    if (!found) {
      var aliases = getNameAliases(name);
      for (var i = 0; i < aliases.length && !found; i++) {
        var alias = aliases[i];
        polygonSeries.mapPolygons.each(function (polygon) {
          if (!found && polygon.dataItem && polygon.dataItem.dataContext.name === alias) {
            found = polygon;
          }
        });
      }
    }

    // Clear any continent highlighting so the selected country is visible
    clearContinentHighlight();

    if (found) {
      if (previousPolygon && previousPolygon !== found) {
        previousPolygon.set("active", false);
      }
      previousPolygon = found;

      // Directly select rather than using set("active") to avoid double-handling
      var id = found.dataItem.get("id");
      selectCountry(id);
      found.setAll({ fill: am5.color(0x800000) });

      var mapName = found.dataItem.dataContext.name;
      showFlagPanel(mapName);
      highlightSidebarItem(name);
    } else {
      showFlagPanel(name);
      highlightSidebarItem(name);
    }
  }

  function getNameAliases(name) {
    var aliases = [];
    for (var key in COUNTRIES_DATA) {
      if (COUNTRIES_DATA[key].display === name) {
        aliases.push(key);
      }
    }
    return aliases;
  }

  // ── Flag Panel ──
  function showFlagPanel(name) {
    activeCountry = name;
    var cd = COUNTRIES_DATA[name];
    if (!cd) {
      var extra = EXTRA_FLAGS.find(function (e) { return e.name === name; });
      if (extra) {
        cd = { flag: extra.flag, continent: extra.continent, display: name };
      }
    }
    if (!cd) {
      for (var key in COUNTRIES_DATA) {
        if (COUNTRIES_DATA[key].display === name) {
          cd = COUNTRIES_DATA[key];
          break;
        }
      }
    }
    if (!cd) return;

    el.panelImg.src = getFlagPath(cd.flag);
    el.panelImg.alt = cd.display || name;
    el.panelName.textContent = cd.display || name;

    var contName = CONTINENTS[cd.continent] ? CONTINENTS[cd.continent].name : cd.continent;
    el.panelBadge.textContent = contName;

    el.neighbors.innerHTML = '';
    var sameContinent = fullList.filter(function (c) {
      return c.continent === cd.continent && c.name !== (cd.display || name);
    });
    var shown = sameContinent.slice(0, 9);
    shown.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'neighbor-item';
      div.innerHTML = '<img src="' + encodeURI(getFlagPath(c.flag)) + '" alt="' + escapeHtml(c.name) + '">' +
                      '<span>' + escapeHtml(c.name) + '</span>';
      div.addEventListener('click', function () {
        rotateToCountryByName(c.name, c.topoName);
      });
      el.neighbors.appendChild(div);
    });

    el.panel.classList.remove('hidden');
  }

  function closeFlagPanel() {
    el.panel.classList.add('hidden');
    activeCountry = null;
    if (previousPolygon) {
      previousPolygon.set("active", false);
      previousPolygon.set("fill", am5.color(0xd9d9d9));
      previousPolygon = undefined;
    }
    var items = el.countryList.querySelectorAll('.country-item');
    items.forEach(function (item) { item.classList.remove('active'); });
  }

  function highlightSidebarItem(name) {
    var items = el.countryList.querySelectorAll('.country-item');
    items.forEach(function (item) {
      if (item.dataset.name === name) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  // ── Sidebar ──
  function renderSidebar() {
    var filtered = fullList;
    if (activeContinent !== 'all') {
      if (activeContinent === 'northamerica') {
        filtered = fullList.filter(function (c) {
          return c.continent === 'northamerica' || c.continent === 'southamerica';
        });
      } else {
        filtered = fullList.filter(function (c) { return c.continent === activeContinent; });
      }
    }

    el.sidebarCount.textContent = filtered.length;
    el.countryList.innerHTML = '';

    filtered.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'country-item';
      div.dataset.name = c.name;
      div.innerHTML = '<img src="' + encodeURI(getFlagPath(c.flag)) + '" alt="' + escapeHtml(c.name) + '" loading="lazy">' +
                      '<span class="country-name">' + escapeHtml(c.name) + '</span>';
      div.addEventListener('click', function () {
        rotateToCountryByName(c.name, c.topoName);
      });
      el.countryList.appendChild(div);
    });
  }

  // ── Search ──
  var searchTimer = null;

  function handleSearch() {
    var q = el.search.value.trim().toLowerCase();
    if (q.length < 1) {
      el.searchDrop.classList.add('hidden');
      el.searchDrop.innerHTML = '';
      return;
    }

    var matches = fullList.filter(function (c) {
      return c.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 12);

    if (matches.length === 0) {
      el.searchDrop.classList.add('hidden');
      el.searchDrop.innerHTML = '';
      return;
    }

    el.searchDrop.innerHTML = '';
    matches.forEach(function (c) {
      var div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = '<img src="' + encodeURI(getFlagPath(c.flag)) + '" alt="' + escapeHtml(c.name) + '">' +
                      '<span>' + escapeHtml(c.name) + '</span>';
      div.addEventListener('click', function () {
        el.search.value = '';
        el.searchDrop.classList.add('hidden');
        rotateToCountryByName(c.name);
      });
      el.searchDrop.appendChild(div);
    });
    el.searchDrop.classList.remove('hidden');
  }

  // ── Event Bindings ──
  function bindEvents() {
    el.search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(handleSearch, 150);
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#search-box')) {
        el.searchDrop.classList.add('hidden');
      }
    });

    el.contFilter.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-btn');
      if (!btn) return;
      el.contFilter.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeContinent = btn.dataset.continent;
      renderSidebar();

      // Rotate globe to the selected continent and highlight its countries
      if (activeContinent !== 'all') {
        rotateToContinentCenter(activeContinent);
        highlightContinentOnMap(activeContinent);
      } else {
        clearContinentHighlight();
      }
    });

    el.panelClose.addEventListener('click', closeFlagPanel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.panel.classList.contains('hidden')) {
          closeFlagPanel();
        } else if (!el.searchDrop.classList.contains('hidden')) {
          el.searchDrop.classList.add('hidden');
          el.search.value = '';
        }
      }
    });
  }

  // ── Utility ──
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Start ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();