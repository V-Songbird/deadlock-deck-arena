/* Deadlock Deck: El Reloj Anatómico — data.js
   All content: cards, limbs, stumps, enemies, base bodies, cosmetics.
   Card effects are code: play(c) receives the combat context (see combat.js). */
(function () {
  'use strict';
  const DD = window.DD;

  DD.SLOTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
  DD.SLOT_TYPE = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  DD.SLOT_NAME = {
    head: 'Cabeza', torso: 'Torso', armL: 'Brazo izq.', armR: 'Brazo der.',
    legL: 'Pierna izq.', legR: 'Pierna der.'
  };

  DD.CARDS = {};
  DD.LIMBS = {};
  DD.ENEMIES = {};

  // ---- helpers (private) ------------------------------------------------
  function card(id, name, type, cost, heat, wear, desc, play) {
    DD.CARDS[id] = { id: id, name: name, type: type, cost: cost, heat: heat, wear: wear, desc: desc, play: play };
    return id;
  }
  function limb(id, name, slot, integrity, passive, style, color, desc, cards) {
    DD.LIMBS[id] = {
      id: id, name: name, slot: slot, integrity: integrity, cards: cards, passive: passive, desc: desc,
      look: { style: style, color: color }
    };
    return id;
  }

  // ======================================================================
  // STUMP CARDS (muñones): weak, no heat, no wear
  // ======================================================================
  card('stump_head', 'Cabezazo Torpe', 'attack', 1, 0, 0, 'Inflige 2.', function (c) { c.damage(2); });
  card('stump_torso', 'Jadeo', 'skill', 1, 0, 0, 'Bloquea 2.', function (c) { c.block(2); });
  card('stump_arm', 'Muñonazo', 'attack', 1, 0, 0, 'Inflige 3.', function (c) { c.damage(3); });
  card('stump_leg', 'Cojear', 'skill', 1, 0, 0, 'Bloquea 2.', function (c) { c.block(2); });
  DD.STUMPS = { head: 'stump_head', torso: 'stump_torso', arm: 'stump_arm', leg: 'stump_leg' };

  // ======================================================================
  // HEADS
  // ======================================================================
  limb('head_homunculo', 'Cabeza de Homúnculo', 'head', 3, { vision: 1 }, 'flesh', '#d8b8a8',
    'Rostro pálido y chillón. Ve un poco más lejos.', [
      card('c_chillido', 'Chillido Agudo', 'skill', 1, 5, 0, 'Bloquea 4. Debilita 1.',
        function (c) { c.block(4); c.status('enemy', 'weak', 1); }),
      card('c_mordisco', 'Mordisco Pálido', 'attack', 0, 10, 0, 'Inflige 3.',
        function (c) { c.damage(3); })
    ]);

  limb('head_alquimista', 'Cráneo del Alquimista', 'head', 3, { draw: 1 }, 'bone', '#cdbf94',
    'Los anteojos aún destilan ideas. +1 robo.', [
      card('c_alambique', 'Alambique Ardiente', 'attack', 1, 15, 0, 'Inflige 4. Quemadura 3.',
        function (c) { c.damage(4); c.status('enemy', 'burn', 3); }),
      card('c_destilar', 'Destilar Recuerdos', 'skill', 1, 10, 0, 'Roba 2 cartas.',
        function (c) { c.draw(2); }),
      card('c_fuego_griego', 'Fuego Griego', 'attack', 2, 40, 1, 'Inflige 8. Quemadura 6.',
        function (c) { c.damage(8); c.status('enemy', 'burn', 6); })
    ]);

  limb('head_cirujano', 'Máscara del Cirujano', 'head', 4, { cool: 3 }, 'bone', '#9fb8b0',
    'Frío pulso quirúrgico. Disipa +3 de calor.', [
      card('c_bisturi_ocular', 'Bisturí Ocular', 'attack', 1, 10, 0, 'Inflige 5. Sangrado 2.',
        function (c) { c.damage(5); c.status('enemy', 'bleed', 2); }),
      card('c_anestesia', 'Anestesia', 'skill', 2, 20, 0, 'Aturde 1. Bloquea 5.',
        function (c) { c.status('enemy', 'stun', 1); c.block(5); }),
      card('c_sutura_precisa', 'Sutura Precisa', 'skill', 1, 0, 0, 'Repara 1. Bloquea 4.',
        function (c) { c.repair(1); c.block(4); })
    ]);

  limb('head_golem', 'Yelmo del Gólem', 'head', 6, { maxHp: 8 }, 'brass', '#c89b3c',
    'Latón macizo, sordo al dolor. +8 PV máx.', [
      card('c_cabezazo_laton', 'Cabezazo de Latón', 'attack', 2, 30, 1, 'Inflige 14.',
        function (c) { c.damage(14); }),
      card('c_presion_vapor', 'Presión de Vapor', 'skill', 1, 20, 0, 'Bloquea 9.',
        function (c) { c.block(9); })
    ]);

  limb('head_sanguijuela', 'Boca de Sanguijuela', 'head', 3, { maxHp: 4 }, 'slime', '#5c7a3a',
    'Anillos de dientes sedientos. +4 PV máx.', [
      card('c_succion', 'Succión', 'attack', 1, 10, 0, 'Inflige 5 y te curas lo infligido.',
        function (c) { c.heal(c.damage(5)); }),
      card('c_sed', 'Sed Insaciable', 'skill', 0, 5, 0, 'Pierdes 3 PV. +1 energía. Roba 1.',
        function (c) { c.hurtSelf(3); c.energy(1); c.draw(1); })
    ]);

  limb('head_quimera', 'Testa de Quimera', 'head', 2, { vision: 2 }, 'scaled', '#8a5a3a',
    'Tres fauces y ojos de presa. Frágil. +2 visión.', [
      card('c_tres_fauces', 'Tres Fauces', 'attack', 2, 30, 1, '3 golpes de 4.',
        function (c) { c.hits(4, 3); }),
      card('c_olfato', 'Olfato de Presa', 'skill', 0, 0, 0, 'Vulnerable 1.',
        function (c) { c.status('enemy', 'vuln', 1); })
    ]);

  limb('head_rector', 'Monóculo del Rector', 'head', 4, { draw: 1, vision: 1 }, 'brass', '#7a5a1e',
    'Lente carnicera del Rector. +1 robo, +1 visión.', [
      card('c_diagnostico', 'Diagnóstico Letal', 'skill', 1, 10, 0, 'Vulnerable 2. Roba 1.',
        function (c) { c.status('enemy', 'vuln', 2); c.draw(1); }),
      card('c_veredicto', 'Veredicto', 'attack', 2, 35, 1, 'Inflige 10, +4 por cada Vulnerable.',
        function (c) { c.damage(10 + 4 * c.has('enemy', 'vuln')); })
    ]);

  // ======================================================================
  // TORSOS
  // ======================================================================
  limb('torso_homunculo', 'Torso Pálido', 'torso', 3, { maxHp: 2 }, 'flesh', '#d8b8a8',
    'Costillas al aire y un latido frenético.', [
      card('c_latido', 'Latido Frenético', 'skill', 1, 10, 0, 'Roba 1. Cura 2.',
        function (c) { c.draw(1); c.heal(2); }),
      card('c_piel_delgada', 'Piel Delgada', 'skill', 0, 0, 0, 'Bloquea 3.',
        function (c) { c.block(3); })
    ]);

  limb('torso_sanguijuela', 'Vientre de Sanguijuela', 'torso', 4, { maxHp: 6 }, 'slime', '#5c7a3a',
    'Un saco que digiere sangre ajena. +6 PV máx.', [
      card('c_digestion', 'Digestión Ácida', 'skill', 1, 15, 0, 'Inflige 3. Cura 5.',
        function (c) { c.damage(3); c.heal(5); }),
      card('c_banquete', 'Banquete Carmesí', 'attack', 2, 30, 1, 'Inflige 10 y te curas lo infligido.',
        function (c) { c.heal(c.damage(10)); }),
      card('c_coagular', 'Coagular', 'skill', 1, 5, 0, 'Bloquea 6.',
        function (c) { c.block(6); })
    ]);

  limb('torso_golem', 'Caldera del Gólem', 'torso', 6, { maxHp: 10, speed: -0.1 }, 'brass', '#b8643a',
    'Horno de latón. +10 PV máx, pero pesa: −10% velocidad.', [
      card('c_valvula', 'Válvula de Escape', 'skill', 1, 0, 0, 'Enfría todos los miembros 25.',
        function (c) { c.coolSelf(25); }),
      card('c_sobrepresion', 'Sobrepresión', 'attack', 2, 45, 1, 'Inflige 18.',
        function (c) { c.damage(18); }),
      card('c_muro_vapor', 'Muro de Vapor', 'skill', 1, 15, 0, 'Bloquea 8.',
        function (c) { c.block(8); })
    ]);

  limb('torso_alquimista', 'Atanor Portátil', 'torso', 4, { cool: 4 }, 'brass', '#3fa38a',
    'Horno alquímico de bolsillo. Disipa +4 de calor.', [
      card('c_transmutacion', 'Transmutación', 'skill', 1, 20, 0, 'Bloquea 4. Roba 1.',
        function (c) { c.block(4); c.draw(1); }),
      card('c_piedra_filosofal', 'Piedra Filosofal', 'power', 2, 35, 1, 'Fuerza +2. +1 energía.',
        function (c) { c.status('self', 'strength', 2); c.energy(1); }),
      card('c_elixir', 'Elixir Vital', 'skill', 1, 10, 0, 'Cura 6. Enfría 10.',
        function (c) { c.heal(6); c.coolSelf(10); })
    ]);

  limb('torso_cirujano', 'Chaleco de Instrumental', 'torso', 5, { maxHp: 4 }, 'bone', '#9fb8b0',
    'Pecho tachonado de bisturíes. +4 PV máx.', [
      card('c_instrumental', 'Instrumental Afilado', 'power', 1, 10, 0, 'Espinas 3.',
        function (c) { c.status('self', 'thorns', 3); }),
      card('c_transfusion', 'Transfusión', 'skill', 2, 10, 0, 'Cura 10. Enfría 15.',
        function (c) { c.heal(10); c.coolSelf(15); }),
      card('c_cauterio', 'Cauterio', 'attack', 1, 20, 0, 'Inflige 4. Bloquea 4.',
        function (c) { c.damage(4); c.block(4); })
    ]);

  limb('torso_quimera', 'Pecho de Quimera', 'torso', 4, { maxHp: 6 }, 'scaled', '#8a5a3a',
    'Piel cosida de tres bestias. +6 PV máx.', [
      card('c_pelaje', 'Pelaje Erizado', 'skill', 1, 5, 0, 'Bloquea 4. Espinas 2.',
        function (c) { c.block(4); c.status('self', 'thorns', 2); }),
      card('c_furia_cosida', 'Furia Cosida', 'power', 1, 20, 0, 'Pierdes 2 PV. Fuerza +2.',
        function (c) { c.hurtSelf(2); c.status('self', 'strength', 2); })
    ]);

  limb('torso_rector', 'Corazón de Vapor del Rector', 'torso', 4, { energy: 1, cool: -4 }, 'brass', '#a3202a',
    'Late con presión infernal. +1 energía, pero disipa −4 de calor.', [
      card('c_piston', 'Pistón Sanguíneo', 'attack', 1, 30, 1, 'Inflige 9.',
        function (c) { c.damage(9); }),
      card('c_sobrecarga', 'Sobrecarga', 'skill', 0, 40, 1, '+2 energía. Roba 1.',
        function (c) { c.energy(2); c.draw(1); })
    ]);

  // ======================================================================
  // ARMS (usable on armL or armR)
  // ======================================================================
  limb('arm_homunculo', 'Brazo Pálido', 'arm', 3, {}, 'flesh', '#d8b8a8',
    'Un brazo enclenque, pero obediente.', [
      card('c_aranazo', 'Arañazo', 'attack', 1, 5, 0, 'Inflige 6.',
        function (c) { c.damage(6); }),
      card('c_agarron', 'Agarrón Débil', 'attack', 1, 0, 0, 'Inflige 4. Debilita 1.',
        function (c) { c.damage(4); c.status('enemy', 'weak', 1); })
    ]);

  limb('arm_golem', 'Puño de Latón', 'arm', 6, {}, 'brass', '#c89b3c',
    'Golpes de pistón, calor de fragua.', [
      card('c_punetazo', 'Puñetazo de Pistón', 'attack', 2, 40, 1, 'Inflige 16.',
        function (c) { c.damage(16); }),
      card('c_escudo_laton', 'Escudo de Latón', 'skill', 1, 25, 0, 'Bloquea 10.',
        function (c) { c.block(10); }),
      card('c_yunque', 'Yunque', 'attack', 3, 60, 2, 'Inflige 28. Vulnerable 2.',
        function (c) { c.damage(28); c.status('enemy', 'vuln', 2); })
    ]);

  limb('arm_quitina', 'Garra de Mantis', 'arm', 3, {}, 'chitin', '#6a8a3a',
    'Cuchillas de quitina que abren mil heridas.', [
      card('c_tajo_sangrante', 'Tajo Sangrante', 'attack', 1, 10, 0, '2 golpes de 2. Sangrado 3.',
        function (c) { c.hits(2, 2); c.status('enemy', 'bleed', 3); }),
      card('c_danza_cuchillas', 'Danza de Cuchillas', 'attack', 2, 25, 1, '5 golpes de 2. Sangrado 3.',
        function (c) { c.hits(2, 5); c.status('enemy', 'bleed', 3); }),
      card('c_filo_rapido', 'Filo Rápido', 'attack', 0, 15, 0, 'Inflige 2. Sangrado 2.',
        function (c) { c.damage(2); c.status('enemy', 'bleed', 2); })
    ]);

  limb('arm_cirujano', 'Sierra del Cirujano', 'arm', 4, {}, 'brass', '#9fb8b0',
    'Corta, cose y vuelve a cortar.', [
      card('c_amputacion', 'Amputación', 'attack', 2, 25, 1, 'Inflige 10. Sangrado 4.',
        function (c) { c.damage(10); c.status('enemy', 'bleed', 4); }),
      card('c_sutura_rapida', 'Sutura Rápida', 'skill', 1, 0, 0, 'Repara 2. Bloquea 3.',
        function (c) { c.repair(2); c.block(3); }),
      card('c_bisturi_certero', 'Bisturí Certero', 'attack', 0, 5, 0, 'Inflige 3.',
        function (c) { c.damage(3); })
    ]);

  limb('arm_alquimista', 'Brazo Retorta', 'arm', 3, {}, 'brass', '#3fa38a',
    'Un matraz por mano, ácido por sangre.', [
      card('c_vitriolo', 'Vitriolo', 'attack', 1, 20, 0, 'Inflige 4. Quemadura 4.',
        function (c) { c.damage(4); c.status('enemy', 'burn', 4); }),
      card('c_frasco', 'Frasco Explosivo', 'attack', 2, 40, 1, 'Inflige 8. Quemadura 5. +15 calor al azar.',
        function (c) { c.damage(8); c.status('enemy', 'burn', 5); c.heatSelf('random', 15); }),
      card('c_reactivo', 'Reactivo', 'skill', 0, 10, 0, 'Quemadura 2.',
        function (c) { c.status('enemy', 'burn', 2); })
    ]);

  limb('arm_sanguijuela', 'Tentáculo Succionador', 'arm', 3, {}, 'slime', '#5c7a3a',
    'Ventosas que drenan fuerza y sangre.', [
      card('c_abrazo', 'Abrazo Viscoso', 'attack', 1, 5, 0, 'Inflige 4. Debilita 2.',
        function (c) { c.damage(4); c.status('enemy', 'weak', 2); }),
      card('c_chupon', 'Chupón', 'attack', 1, 10, 0, 'Inflige 6. Cura 3.',
        function (c) { c.damage(6); c.heal(3); }),
      card('c_baba', 'Baba Ácida', 'skill', 0, 0, 0, 'Vulnerable 1.',
        function (c) { c.status('enemy', 'vuln', 1); })
    ]);

  limb('arm_quimera', 'Zarpa de Quimera', 'arm', 4, {}, 'scaled', '#8a5a3a',
    'Furia acumulada en cada garra.', [
      card('c_zarpazo', 'Zarpazo Furioso', 'attack', 1, 15, 0, 'Inflige 7.',
        function (c) { c.damage(7); }),
      card('c_rugido', 'Rugido', 'power', 1, 10, 0, 'Fuerza +2.',
        function (c) { c.status('self', 'strength', 2); }),
      card('c_embestida', 'Embestida', 'attack', 2, 30, 1, '2 golpes de 8.',
        function (c) { c.hits(8, 2); })
    ]);

  limb('arm_acolito', 'Mano del Acólito', 'arm', 3, {}, 'bone', '#bfae88',
    'Dedos de hueso, ritos de sangre.', [
      card('c_ofrenda', 'Ofrenda de Sangre', 'skill', 0, 0, 0, 'Pierdes 4 PV. +2 energía.',
        function (c) { c.hurtSelf(4); c.energy(2); }),
      card('c_maldicion', 'Maldición Ósea', 'skill', 1, 10, 0, 'Vulnerable 2. Debilita 1.',
        function (c) { c.status('enemy', 'vuln', 2); c.status('enemy', 'weak', 1); }),
      card('c_vial_impio', 'Vial Impío', 'attack', 1, 25, 0, 'Inflige 5. Quemadura 3. Sangrado 3.',
        function (c) { c.damage(5); c.status('enemy', 'burn', 3); c.status('enemy', 'bleed', 3); })
    ]);

  limb('arm_rector', 'Prótesis del Rector', 'arm', 5, {}, 'brass', '#7a5a1e',
    'Latón hidráulico que sierra la carne.', [
      card('c_sierra_hidraulica', 'Sierra Hidráulica', 'attack', 2, 45, 1, 'Inflige 20.',
        function (c) { c.damage(20); }),
      card('c_garra_mecanica', 'Garra Mecánica', 'attack', 1, 20, 0, 'Inflige 8. Bloquea 4.',
        function (c) { c.damage(8); c.block(4); }),
      card('c_engranaje', 'Engranaje Furioso', 'power', 1, 25, 0, 'Fuerza +1. Espinas 2.',
        function (c) { c.status('self', 'strength', 1); c.status('self', 'thorns', 2); })
    ]);

  // ======================================================================
  // LEGS (usable on legL or legR)
  // ======================================================================
  limb('leg_homunculo', 'Pierna Enclenque', 'leg', 3, {}, 'flesh', '#d8b8a8',
    'Corta, torcida, pero corre.', [
      card('c_patada', 'Patada Torpe', 'attack', 1, 5, 0, 'Inflige 5.',
        function (c) { c.damage(5); }),
      card('c_brinco', 'Brinco', 'skill', 0, 0, 0, 'Bloquea 3.',
        function (c) { c.block(3); })
    ]);

  limb('leg_quimera', 'Pata de Quimera', 'leg', 3, { speed: 0.2 }, 'scaled', '#8a5a3a',
    'Músculo felino. +20% velocidad.', [
      card('c_esquiva', 'Esquiva Felina', 'skill', 1, 5, 0, 'Bloquea 7. Roba 1.',
        function (c) { c.block(7); c.draw(1); }),
      card('c_salto', 'Salto Depredador', 'attack', 1, 15, 0, 'Inflige 7. Vulnerable 1.',
        function (c) { c.damage(7); c.status('enemy', 'vuln', 1); }),
      card('c_zancada', 'Zancada Veloz', 'skill', 0, 15, 0, '+1 energía.',
        function (c) { c.energy(1); })
    ]);

  limb('leg_golem', 'Pilar de Latón', 'leg', 6, { maxHp: 4, speed: -0.1 }, 'brass', '#c89b3c',
    'Una columna de metal. +4 PV máx, −10% velocidad.', [
      card('c_pisoton', 'Pisotón', 'attack', 2, 35, 1, 'Inflige 12. Vulnerable 1.',
        function (c) { c.damage(12); c.status('enemy', 'vuln', 1); }),
      card('c_anclaje', 'Anclaje', 'skill', 1, 10, 0, 'Bloquea 7. Espinas 2.',
        function (c) { c.block(7); c.status('self', 'thorns', 2); })
    ]);

  limb('leg_sanguijuela', 'Ventosa Reptante', 'leg', 3, { cool: 4 }, 'slime', '#5c7a3a',
    'Carne húmeda que disipa el calor. +4 enfriamiento.', [
      card('c_rastro', 'Rastro Viscoso', 'skill', 1, 0, 0, 'Bloquea 4. Debilita 2.',
        function (c) { c.block(4); c.status('enemy', 'weak', 2); }),
      card('c_reptar', 'Reptar', 'skill', 1, 5, 0, 'Bloquea 5. Cura 2.',
        function (c) { c.block(5); c.heal(2); })
    ]);

  limb('leg_cirujano', 'Pierna Ortopédica', 'leg', 4, { speed: 0.1 }, 'brass', '#9fb8b0',
    'Resortes y tornillos de precisión. +10% velocidad.', [
      card('c_resorte', 'Patada de Resorte', 'attack', 1, 10, 0, 'Inflige 5. Roba 1.',
        function (c) { c.damage(5); c.draw(1); }),
      card('c_tornillos', 'Ajuste de Tornillos', 'skill', 1, 0, 0, 'Repara 1. Enfría 10.',
        function (c) { c.repair(1); c.coolSelf(10); })
    ]);

  limb('leg_quitina', 'Pata de Insecto', 'leg', 3, { speed: 0.15 }, 'chitin', '#6a8a3a',
    'Articulaciones de langosta. +15% velocidad.', [
      card('c_puntas', 'Puntas Afiladas', 'attack', 1, 5, 0, '2 golpes de 2. Sangrado 2.',
        function (c) { c.hits(2, 2); c.status('enemy', 'bleed', 2); }),
      card('c_langosta', 'Salto de Langosta', 'skill', 0, 10, 0, 'Bloquea 4. Roba 1.',
        function (c) { c.block(4); c.draw(1); })
    ]);

  limb('leg_acolito', 'Pierna Fúnebre', 'leg', 3, {}, 'bone', '#bfae88',
    'Huesos que danzan al son de un réquiem.', [
      card('c_danza_macabra', 'Danza Macabra', 'skill', 1, 10, 0, 'Bloquea 3. Espinas 2.',
        function (c) { c.block(3); c.status('self', 'thorns', 2); }),
      card('c_paso_funebre', 'Paso Fúnebre', 'skill', 0, 0, 0, 'Enfría 15.',
        function (c) { c.coolSelf(15); })
    ]);

  limb('leg_rector', 'Pistones del Rector', 'leg', 5, { speed: 0.1 }, 'brass', '#7a5a1e',
    'Pistones de vapor. +10% velocidad.', [
      card('c_patada_hidraulica', 'Patada Hidráulica', 'attack', 2, 40, 1, 'Inflige 15.',
        function (c) { c.damage(15); }),
      card('c_impulso', 'Impulso Hidráulico', 'skill', 1, 20, 0, '+1 energía. Roba 2.',
        function (c) { c.energy(1); c.draw(2); })
    ]);

  // ======================================================================
  // ENEMIES  (hp is the floor-1 value; combat scales it by floor)
  // ======================================================================
  function enemy(o) { DD.ENEMIES[o.id] = o; }

  enemy({
    id: 'homunculo', name: 'Homúnculo', kind: 'monster', hp: 24, floorMin: 1, ether: 3,
    limbs: ['head_homunculo', 'torso_homunculo', 'arm_homunculo', 'leg_homunculo'],
    intents: [{ type: 'attack', dmg: 5 }, { type: 'attack', dmg: 3, times: 2 }, { type: 'debuff', status: 'weak', n: 2 }],
    desc: 'Una cosa pálida y chillona, cuajada en un frasco.'
  });
  enemy({
    id: 'sanguijuela', name: 'Sanguijuela Gigante', kind: 'monster', hp: 30, floorMin: 1, ether: 4,
    limbs: ['head_sanguijuela', 'torso_sanguijuela', 'arm_sanguijuela', 'leg_sanguijuela'],
    intents: [{ type: 'attack', dmg: 5 }, { type: 'debuff', status: 'bleed', n: 3 }, { type: 'heal', n: 6 }, { type: 'attack', dmg: 7 }],
    desc: 'Se hincha con la sangre de los desdichados.'
  });
  enemy({
    id: 'alquimista', name: 'Alquimista Loco', kind: 'scientist', hp: 28, floorMin: 1, ether: 4,
    limbs: ['head_alquimista', 'torso_alquimista', 'arm_alquimista'],
    intents: [{ type: 'scald', heat: 30 }, { type: 'attack', dmg: 6 }, { type: 'debuff', status: 'burn', n: 3 }, { type: 'block', n: 8 }],
    desc: 'Lanza frascos hirvientes y ríe entre los vapores.'
  });
  enemy({
    id: 'quimera', name: 'Quimera Cosida', kind: 'monster', hp: 38, floorMin: 2, ether: 6,
    limbs: ['head_quimera', 'torso_quimera', 'arm_quimera', 'leg_quimera'],
    intents: [{ type: 'attack', dmg: 8 }, { type: 'attack', dmg: 4, times: 3 }, { type: 'buff', strength: 2 }, { type: 'attack', dmg: 10 }],
    desc: 'Retazos de tres bestias, unidos por la rabia.'
  });
  enemy({
    id: 'cirujano', name: 'Cirujano Demente', kind: 'scientist', hp: 36, floorMin: 2, ether: 6,
    limbs: ['head_cirujano', 'torso_cirujano', 'arm_cirujano', 'leg_cirujano'],
    intents: [{ type: 'sever', n: 1 }, { type: 'attack', dmg: 9 }, { type: 'block', n: 8 }, { type: 'attack', dmg: 5, times: 2 }],
    desc: 'Su sierra desea tus miembros más que tu vida.'
  });
  enemy({
    id: 'acolito', name: 'Acólito del Enjambre', kind: 'scientist', hp: 32, floorMin: 2, ether: 5,
    limbs: ['arm_acolito', 'leg_acolito', 'arm_quitina', 'leg_quitina'],
    intents: [{ type: 'debuff', status: 'vuln', n: 2 }, { type: 'attack', dmg: 7 }, { type: 'scald', heat: 25 }, { type: 'buff', strength: 1 }, { type: 'debuff', status: 'weak', n: 2 }],
    desc: 'Encapuchado, reza a un dios de mil patas.'
  });
  enemy({
    id: 'golem', name: 'Gólem de Latón', kind: 'monster', hp: 54, floorMin: 3, ether: 9,
    limbs: ['head_golem', 'torso_golem', 'arm_golem', 'leg_golem'],
    intents: [{ type: 'block', n: 10 }, { type: 'attack', dmg: 12 }, { type: 'scald', heat: 25 }, { type: 'attack', dmg: 16 }],
    desc: 'Autómata de latón que aún arde en su vieja caldera.'
  });
  enemy({
    id: 'rector', name: 'El Rector Carnicero', kind: 'scientist', hp: 84, floorMin: 3, boss: true, ether: 25,
    limbs: ['head_rector', 'torso_rector', 'arm_rector', 'leg_rector'],
    intents: [
      { type: 'attack', dmg: 9 }, { type: 'buff', strength: 1 }, { type: 'attack', dmg: 5, times: 3 },
      { type: 'scald', heat: 30 }, { type: 'sever', n: 1 }, { type: 'attack', dmg: 16 }, { type: 'block', n: 12 }
    ],
    desc: 'Amo de la torre. Sus prótesis de latón cortan mejor que cualquier bisturí.'
  });

  // ======================================================================
  // BASE BODIES
  // ======================================================================
  DD.BASE_BODIES = [
    {
      id: 'remendado', name: 'El Remendado', unlock: 'free',
      desc: 'Un homúnculo cosido a toda prisa. Débil, pero equilibrado.',
      slots: { head: 'head_homunculo', torso: 'torso_homunculo', armL: 'arm_homunculo', armR: 'arm_homunculo', legL: 'leg_homunculo', legR: 'leg_homunculo' }
    },
    {
      id: 'cadaver_cirujano', name: 'Cadáver del Cirujano', unlock: 'free',
      desc: 'Restos de un cirujano: sierra, suturas y frío pulso.',
      slots: { head: 'head_cirujano', torso: 'torso_homunculo', armL: 'arm_cirujano', armR: 'arm_homunculo', legL: 'leg_cirujano', legR: 'leg_homunculo' }
    },
    {
      id: 'nido_quitina', name: 'Nido de Quitina', unlock: 'shop', price: 60,
      desc: 'Garras y patas de insecto. Sangrado veloz y letal.',
      slots: { head: 'head_homunculo', torso: 'torso_sanguijuela', armL: 'arm_quitina', armR: 'arm_quitina', legL: 'leg_quitina', legR: 'leg_quitina' }
    },
    {
      id: 'coloso_laton', name: 'Coloso de Latón', unlock: 'shop', price: 90,
      desc: 'Un titán de latón: golpes brutales, calor devastador.',
      slots: { head: 'head_golem', torso: 'torso_golem', armL: 'arm_golem', armR: 'arm_golem', legL: 'leg_homunculo', legR: 'leg_homunculo' }
    },
    {
      id: 'bestia_cosida', name: 'Bestia Cosida', unlock: 'shop', price: 120,
      desc: 'Quimera de cañón de cristal: furia, velocidad y poco aguante.',
      slots: { head: 'head_quimera', torso: 'torso_quimera', armL: 'arm_quimera', armR: 'arm_quimera', legL: 'leg_quimera', legR: 'leg_quimera' }
    }
  ];

  // ======================================================================
  // COSMETICS (skins)
  // ======================================================================
  DD.COSMETICS = [
    { id: 'none', name: 'Carne Original', tint: null, price: 0 },
    { id: 'ceniza', name: 'Piel de Ceniza', tint: '#9a9a9a', price: 15 },
    { id: 'cardenillo', name: 'Cardenillo', tint: '#3fa38a', price: 25 },
    { id: 'sangre', name: 'Sangre Seca', tint: '#a3202a', price: 30 },
    { id: 'laton', name: 'Baño de Latón', tint: '#c89b3c', price: 40 },
    { id: 'violeta', name: 'Éter Violeta', tint: '#6b3fa0', price: 40 },
    { id: 'hielo', name: 'Escarcha Alquímica', tint: '#4ab8ff', price: 50 },
    { id: 'ascua', name: 'Ascua Viva', tint: '#ff7a1a', price: 60 }
  ];
})();
