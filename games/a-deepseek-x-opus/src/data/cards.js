/* Deadlock Deck — card data.
 * ~100 cards: 6 stump basics + 3-4 per limb. Every id here is referenced by limbs.js
 * (except the six stump cards). Spanish text, English identifiers. See SPEC.md 3.2 / 2.7. */
(function () {
  'use strict';
  var DD = window.DD;

  DD.Data.cards = [

    /* ---------- stump / basic cards (a broken socket contributes these) ---------- */
    { id: 'stump_punch', name: DD.t('Puñetazo de Muñón'), cost: 0, type: 'attack', rarity: 'common', heat: 0,
      desc: DD.t('Inflige 3 de daño.'), art: 'cicon_bone',
      effects: [{ k: 'damage', v: 3 }] },

    { id: 'stump_guard', name: DD.t('Guardia de Muñón'), cost: 0, type: 'block', rarity: 'common', heat: 0,
      desc: DD.t('Ganas 3 de Bloqueo.'), art: 'cicon_hand',
      effects: [{ k: 'block', v: 3 }] },

    { id: 'stump_scrabble', name: DD.t('Forcejeo'), cost: 0, type: 'skill', rarity: 'common', heat: 0,
      desc: DD.t('Ganas 2 de residuo y enfrías 4 de calor.'), art: 'cicon_tendril',
      effects: [{ k: 'residue', v: 2 }, { k: 'cool', v: 4, socket: null }] },

    { id: 'stump_lurch', name: DD.t('Tambaleo'), cost: 1, type: 'attack', rarity: 'common', heat: 0,
      desc: DD.t('Inflige 5 de daño y ganas 3 de Bloqueo.'), art: 'cicon_foot',
      effects: [{ k: 'damage', v: 5 }, { k: 'block', v: 3 }] },

    { id: 'stump_screech', name: DD.t('Chillido'), cost: 1, type: 'skill', rarity: 'common', heat: 0,
      desc: DD.t('Aplica 1 de Debilidad y 1 de Vulnerabilidad a todos los enemigos.'), art: 'cicon_jaw',
      effects: [{ k: 'weak', v: 1, all: true }, { k: 'vulnerable', v: 1, all: true }] },

    { id: 'stump_bite', name: DD.t('Mordisco'), cost: 1, type: 'attack', rarity: 'common', heat: 0,
      desc: DD.t('Inflige 6 de daño y aplica 1 de Sangrado.'), art: 'cicon_needle',
      effects: [{ k: 'damage', v: 6 }, { k: 'bleed', v: 1 }] },

    /* ---------- head limbs ---------- */
    /* skull_ossuary — osario: cheap, brittle */
    { id: 'ossuary_glare', name: DD.t('Mirada Osaria'), cost: 0, type: 'skill', rarity: 'common', heat: 2,
      desc: DD.t('Aplica 1 de Debilidad.'), art: 'cicon_eye',
      effects: [{ k: 'weak', v: 1 }] },

    { id: 'skull_tap', name: DD.t('Golpe de Cráneo'), cost: 1, type: 'attack', rarity: 'common', heat: 4,
      desc: DD.t('Inflige 6 de daño.'), art: 'cicon_skull',
      effects: [{ k: 'damage', v: 6 }] },

    { id: 'bone_focus', name: DD.t('Foco Óseo'), cost: 1, type: 'skill', rarity: 'common', heat: 4,
      desc: DD.t('Robas 2 cartas.'), art: 'cicon_bone',
      effects: [{ k: 'draw', v: 2 }] },

    /* fleshy_face — visceral */
    { id: 'blood_spit', name: DD.t('Escupitajo Sangriento'), cost: 0, type: 'attack', rarity: 'common', heat: 2,
      desc: DD.t('Inflige 3 de daño y aplica 1 de Sangrado.'), art: 'cicon_blood',
      effects: [{ k: 'damage', v: 3 }, { k: 'bleed', v: 1 }] },

    { id: 'raw_scream', name: DD.t('Alarido Crudo'), cost: 1, type: 'skill', rarity: 'common', heat: 5,
      desc: DD.t('Aplica 2 de Debilidad a todos los enemigos.'), art: 'cicon_jaw',
      effects: [{ k: 'weak', v: 2, all: true }] },

    { id: 'gorge', name: DD.t('Engullir'), cost: 1, type: 'attack', rarity: 'uncommon', heat: 6,
      desc: DD.t('Inflige 5 de daño. Te curas 4 PV.'), art: 'cicon_tendril',
      effects: [{ k: 'damage', v: 5 }, { k: 'lifesteal', v: 4 }] },

    /* mech_cranium — mecánico */
    { id: 'pressure_valve', name: DD.t('Válvula de Presión'), cost: 0, type: 'skill', rarity: 'common', heat: 0,
      desc: DD.t('Enfrías 6 de calor de este socket.'), art: 'cicon_steam',
      effects: [{ k: 'cool', v: 6, socket: null }] },

    { id: 'cog_shot', name: DD.t('Disparo de Engranaje'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 7 de daño.'), art: 'cicon_gear',
      effects: [{ k: 'damage', v: 7 }] },

    { id: 'brass_guard', name: DD.t('Guardia de Latón'), cost: 1, type: 'block', rarity: 'common', heat: 4,
      desc: DD.t('Ganas 8 de Bloqueo.'), art: 'cicon_gear',
      effects: [{ k: 'block', v: 8 }] },

    { id: 'overclock', name: DD.t('Sobremarcha'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 6,
      desc: DD.t('Ganas 2 de energía. Esta carta se agota.'), art: 'cicon_lightning',
      effects: [{ k: 'energy', v: 2 }, { k: 'exhaustSelf' }] },

    /* seer_skull — espectral */
    { id: 'ecto_insight', name: DD.t('Intuición Ectoplásmica'), cost: 1, type: 'skill', rarity: 'common', heat: 6,
      desc: DD.t('Robas 2 cartas.'), art: 'cicon_eye',
      effects: [{ k: 'draw', v: 2 }] },

    { id: 'soul_siphon', name: DD.t('Sifón de Almas'), cost: 1, type: 'attack', rarity: 'common', heat: 8,
      desc: DD.t('Inflige 5 de daño. Te curas 5 PV.'), art: 'cicon_heart',
      effects: [{ k: 'damage', v: 5 }, { k: 'lifesteal', v: 5 }] },

    { id: 'dread_gaze', name: DD.t('Mirada de Pavor'), cost: 2, type: 'skill', rarity: 'uncommon', heat: 12,
      desc: DD.t('Aplica 2 de Vulnerabilidad a todos los enemigos y aturde 1 turno al objetivo.'), art: 'cicon_skull',
      effects: [{ k: 'vulnerable', v: 2, all: true }, { k: 'stun', v: 1 }] },

    { id: 'third_eye', name: DD.t('Tercer Ojo'), cost: 2, type: 'power', rarity: 'rare', heat: 10,
      desc: DD.t('Robas 3 cartas y ganas 1 de energía.'), art: 'cicon_eye',
      effects: [{ k: 'draw', v: 3 }, { k: 'energy', v: 1 }] },

    /* venom_cortex — alquímico */
    { id: 'venom_drip', name: DD.t('Goteo Venenoso'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 4 de daño y aplica 3 de Veneno.'), art: 'cicon_venom',
      effects: [{ k: 'damage', v: 4 }, { k: 'poison', v: 3 }] },

    { id: 'distill', name: DD.t('Destilar'), cost: 1, type: 'skill', rarity: 'common', heat: 4,
      desc: DD.t('Ganas 4 de residuo.'), art: 'cicon_serum',
      effects: [{ k: 'residue', v: 4 }] },

    { id: 'weakening_fumes', name: DD.t('Vapores Debilitantes'), cost: 2, type: 'skill', rarity: 'uncommon', heat: 10,
      desc: DD.t('Aplica 2 de Debilidad y 2 de Vulnerabilidad a todos los enemigos.'), art: 'cicon_lung',
      effects: [{ k: 'weak', v: 2, all: true }, { k: 'vulnerable', v: 2, all: true }] },

    { id: 'mind_venom', name: DD.t('Veneno Mental'), cost: 2, type: 'skill', rarity: 'uncommon', heat: 12,
      desc: DD.t('Aplica 8 de Veneno a todos los enemigos.'), art: 'cicon_brain',
      effects: [{ k: 'poison', v: 8, all: true }] },

    /* frost_mind — criogénico, tier 3 signature */
    { id: 'absolute_zero', name: DD.t('Cero Absoluto'), cost: 3, type: 'skill', rarity: 'rare', heat: 22,
      desc: DD.t('Aplica 3 de Vulnerabilidad y 2 de Debilidad a todos los enemigos. Enfrías 18 de calor.'),
      art: 'cicon_frost',
      effects: [{ k: 'vulnerable', v: 3, all: true }, { k: 'weak', v: 2, all: true },
        { k: 'cool', v: 18, socket: null }] },

    { id: 'permafrost', name: DD.t('Permafrost'), cost: 2, type: 'power', rarity: 'rare', heat: 12,
      desc: DD.t('Ganas 12 de Bloqueo y enfrías 12 de calor.'), art: 'cicon_crystal',
      effects: [{ k: 'block', v: 12 }, { k: 'cool', v: 12, socket: null }] },

    { id: 'frost_thought', name: DD.t('Pensamiento Gélido'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 5,
      desc: DD.t('Robas 2 cartas y enfrías 6 de calor.'), art: 'cicon_crystal',
      effects: [{ k: 'draw', v: 2 }, { k: 'cool', v: 6, socket: null }] },

    { id: 'numbing_gaze', name: DD.t('Mirada Entumecedora'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 5 de daño y aplica 1 de Debilidad a todos los enemigos.'), art: 'cicon_eye',
      effects: [{ k: 'damage', v: 5 }, { k: 'weak', v: 1, all: true }] },

    /* ---------- torso limbs ---------- */
    /* ribcage_ossuary — osario */
    { id: 'rib_splinter', name: DD.t('Astilla Costal'), cost: 0, type: 'attack', rarity: 'common', heat: 3,
      desc: DD.t('Inflige 4 de daño.'), art: 'cicon_spine',
      effects: [{ k: 'damage', v: 4 }] },

    { id: 'bone_plate', name: DD.t('Placa Ósea'), cost: 1, type: 'block', rarity: 'common', heat: 4,
      desc: DD.t('Ganas 7 de Bloqueo.'), art: 'cicon_bone',
      effects: [{ k: 'block', v: 7 }] },

    { id: 'brittle_guard', name: DD.t('Guardia Quebradiza'), cost: 1, type: 'block', rarity: 'uncommon', heat: 3,
      desc: DD.t('Quedas Frágil 2 (ganas un 25% menos de Bloqueo). Ganas 14 de Bloqueo.'), art: 'cicon_spine',
      effects: [{ k: 'frail', v: 2 }, { k: 'block', v: 14 }] },

    /* flesh_hull — visceral */
    { id: 'gristle_bind', name: DD.t('Ligadura de Cartílago'), cost: 1, type: 'block', rarity: 'common', heat: 4,
      desc: DD.t('Ganas 7 de Bloqueo y te curas 2 PV.'), art: 'cicon_tendril',
      effects: [{ k: 'block', v: 7 }, { k: 'heal', v: 2 }] },

    { id: 'blood_let', name: DD.t('Sangría'), cost: 0, type: 'attack', rarity: 'common', heat: 2,
      desc: DD.t('Inflige 4 de daño. Pierdes 2 PV.'), art: 'cicon_blood',
      effects: [{ k: 'damage', v: 4 }, { k: 'selfDamage', v: 2 }] },

    { id: 'crimson_feast', name: DD.t('Festín Carmesí'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 10,
      desc: DD.t('Inflige 9 de daño. Te curas 6 PV.'), art: 'cicon_heart',
      effects: [{ k: 'damage', v: 9 }, { k: 'lifesteal', v: 6 }] },

    { id: 'visceral_mend', name: DD.t('Remiendo Visceral'), cost: 1, type: 'skill', rarity: 'common', heat: 4,
      desc: DD.t('Te curas 6 PV.'), art: 'cicon_serum',
      effects: [{ k: 'heal', v: 6 }] },

    /* boiler_hull — mecánico */
    { id: 'rivet_wall', name: DD.t('Muro de Remaches'), cost: 2, type: 'block', rarity: 'common', heat: 12,
      desc: DD.t('Ganas 14 de Bloqueo.'), art: 'cicon_gear',
      effects: [{ k: 'block', v: 14 }] },

    { id: 'boiler_purge', name: DD.t('Purga de Caldera'), cost: 0, type: 'skill', rarity: 'common', heat: 0,
      desc: DD.t('Enfrías 8 de calor y ganas 3 de Bloqueo.'), art: 'cicon_steam',
      effects: [{ k: 'cool', v: 8, socket: null }, { k: 'block', v: 3 }] },

    { id: 'overpressure', name: DD.t('Sobrepresión'), cost: 2, type: 'block', rarity: 'uncommon', heat: 14,
      desc: DD.t('Ganas 3 de Bloqueo por cada 25 de calor en este socket.'), art: 'cicon_gear',
      effects: [{ k: 'gainBlockPerHeat', v: 3 }] },

    /* ecto_hollow — espectral */
    { id: 'soul_battery', name: DD.t('Batería de Almas'), cost: 0, type: 'skill', rarity: 'common', heat: 3,
      desc: DD.t('Ganas 1 de energía.'), art: 'cicon_crystal',
      effects: [{ k: 'energy', v: 1 }] },

    { id: 'ectoplasm_veil', name: DD.t('Velo de Ectoplasma'), cost: 1, type: 'block', rarity: 'common', heat: 5,
      desc: DD.t('Ganas 6 de Bloqueo y robas 1 carta.'), art: 'cicon_tendril',
      effects: [{ k: 'block', v: 6 }, { k: 'draw', v: 1 }] },

    { id: 'wail', name: DD.t('Lamento'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 12,
      desc: DD.t('Inflige 6 de daño a todos los enemigos.'), art: 'cicon_jaw',
      effects: [{ k: 'damage', v: 6, all: true }] },

    { id: 'spectral_communion', name: DD.t('Comunión Espectral'), cost: 2, type: 'power', rarity: 'rare', heat: 14,
      desc: DD.t('Te curas 10 PV y robas 2 cartas.'), art: 'cicon_tendril',
      effects: [{ k: 'heal', v: 10 }, { k: 'draw', v: 2 }] },

    /* venom_sac — alquímico */
    { id: 'bile_burst', name: DD.t('Estallido de Bilis'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 11,
      desc: DD.t('Inflige 4 de daño y aplica 2 de Veneno a todos los enemigos.'), art: 'cicon_venom',
      effects: [{ k: 'damage', v: 4, all: true }, { k: 'poison', v: 2, all: true }] },

    { id: 'residue_tap', name: DD.t('Sangrado de Residuo'), cost: 0, type: 'skill', rarity: 'common', heat: 2,
      desc: DD.t('Ganas 5 de residuo. El enemigo soltará un miembro extra.'), art: 'cicon_serum',
      effects: [{ k: 'residue', v: 5 }, { k: 'scavenge' }] },

    { id: 'caustic_armor', name: DD.t('Armadura Cáustica'), cost: 1, type: 'block', rarity: 'uncommon', heat: 6,
      desc: DD.t('Ganas 7 de Bloqueo y aplica 2 de Veneno a todos los enemigos.'), art: 'cicon_venom',
      effects: [{ k: 'block', v: 7 }, { k: 'poison', v: 2, all: true }] },

    { id: 'purge_flask', name: DD.t('Frasco de Purga'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 4,
      desc: DD.t('Te curas 4 PV, ganas 3 de residuo y robas 1 carta.'), art: 'cicon_serum',
      effects: [{ k: 'heal', v: 4 }, { k: 'residue', v: 3 }, { k: 'draw', v: 1 }] },

    /* glacier_hull — criogénico, tier 3 signature */
    { id: 'glacier_wall', name: DD.t('Muro Glaciar'), cost: 3, type: 'block', rarity: 'rare', heat: 20,
      desc: DD.t('Ganas 24 de Bloqueo y enfrías 10 de calor.'), art: 'cicon_frost',
      effects: [{ k: 'block', v: 24 }, { k: 'cool', v: 10, socket: null }] },

    { id: 'heart_of_ice', name: DD.t('Corazón de Hielo'), cost: 2, type: 'power', rarity: 'rare', heat: 12,
      desc: DD.t('Ganas 8 de Bloqueo, enfrías 8 de calor y restauras 10 de integridad.'), art: 'cicon_heart',
      effects: [{ k: 'block', v: 8 }, { k: 'cool', v: 8, socket: null }, { k: 'integrity', v: 10, socket: null }] },

    { id: 'thermal_sink', name: DD.t('Sumidero Térmico'), cost: 1, type: 'block', rarity: 'uncommon', heat: 5,
      desc: DD.t('Ganas 6 de Bloqueo y enfrías 6 de calor.'), art: 'cicon_crystal',
      effects: [{ k: 'block', v: 6 }, { k: 'cool', v: 6, socket: null }] },

    { id: 'rime_armor', name: DD.t('Armadura de Escarcha'), cost: 1, type: 'block', rarity: 'common', heat: 5,
      desc: DD.t('Ganas 8 de Bloqueo y restauras 4 de integridad.'), art: 'cicon_frost',
      effects: [{ k: 'block', v: 8 }, { k: 'integrity', v: 4, socket: null }] },

    /* ---------- arm limbs ---------- */
    /* bone_claw — osario */
    { id: 'claw_rake', name: DD.t('Zarpazo'), cost: 0, type: 'attack', rarity: 'common', heat: 3,
      desc: DD.t('Inflige 4 de daño y aplica 1 de Sangrado.'), art: 'cicon_hook',
      effects: [{ k: 'damage', v: 4 }, { k: 'bleed', v: 1 }] },

    { id: 'bone_spike', name: DD.t('Espina Ósea'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 8 de daño.'), art: 'cicon_bone',
      effects: [{ k: 'damage', v: 8 }] },

    { id: 'missing_limb_fury', name: DD.t('Furia de Muñones'), cost: 1, type: 'attack', rarity: 'uncommon', heat: 4,
      desc: DD.t('Inflige 6 de daño por cada miembro amputado.'), art: 'cicon_graft',
      effects: [{ k: 'damagePerMissingLimb', v: 6 }] },

    /* meat_arm — visceral */
    { id: 'rend', name: DD.t('Desgarrar'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 6 de daño y aplica 2 de Sangrado.'), art: 'cicon_blood',
      effects: [{ k: 'damage', v: 6 }, { k: 'bleed', v: 2 }] },

    { id: 'blood_offering', name: DD.t('Ofrenda de Sangre'), cost: 0, type: 'skill', rarity: 'common', heat: 3,
      desc: DD.t('Pierdes 4 PV. Ganas 2 de energía.'), art: 'cicon_heart',
      effects: [{ k: 'selfDamage', v: 4 }, { k: 'energy', v: 2 }] },

    { id: 'feast_of_meat', name: DD.t('Festín de Carne'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 10,
      desc: DD.t('Inflige 8 de daño. Te curas 8 PV.'), art: 'cicon_jaw',
      effects: [{ k: 'damage', v: 8 }, { k: 'lifesteal', v: 8 }] },

    /* piston_arm — mecánico */
    { id: 'piston_jab', name: DD.t('Puñetazo de Pistón'), cost: 2, type: 'attack', rarity: 'common', heat: 10,
      desc: DD.t('Inflige 14 de daño.'), art: 'cicon_gear',
      effects: [{ k: 'damage', v: 14 }] },

    { id: 'hydraulic_ram', name: DD.t('Ariete Hidráulico'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 6 de daño y ganas 4 de Bloqueo.'), art: 'cicon_chain',
      effects: [{ k: 'damage', v: 6 }, { k: 'block', v: 4 }] },

    { id: 'scalding_vent', name: DD.t('Ventilación Hirviente'), cost: 1, type: 'attack', rarity: 'uncommon', heat: 2,
      desc: DD.t('Inflige 4 de daño por cada 25 de calor en este socket. Añades 6 de calor.'), art: 'cicon_flame',
      effects: [{ k: 'damagePerHeat', v: 4 }, { k: 'heat', v: 6, socket: null }] },

    /* phantom_arm — espectral */
    { id: 'ghost_touch', name: DD.t('Toque Fantasmal'), cost: 0, type: 'attack', rarity: 'common', heat: 3,
      desc: DD.t('Inflige 4 de daño y robas 1 carta.'), art: 'cicon_hand',
      effects: [{ k: 'damage', v: 4 }, { k: 'draw', v: 1 }] },

    { id: 'spectral_bolt', name: DD.t('Rayo Espectral'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 9 de daño.'), art: 'cicon_lightning',
      effects: [{ k: 'damage', v: 9 }] },

    { id: 'ecto_leech', name: DD.t('Sanguijuela Etérea'), cost: 1, type: 'attack', rarity: 'uncommon', heat: 8,
      desc: DD.t('Inflige 4 de daño y aplica 4 de Veneno.'), art: 'cicon_needle',
      effects: [{ k: 'damage', v: 4 }, { k: 'poison', v: 4 }] },

    /* venom_stinger — alquímico */
    { id: 'sting', name: DD.t('Aguijonazo'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 5 de daño y aplica 3 de Veneno.'), art: 'cicon_needle',
      effects: [{ k: 'damage', v: 5 }, { k: 'poison', v: 3 }] },

    { id: 'toxic_lash', name: DD.t('Látigo Tóxico'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 4 de daño y aplica 1 de Debilidad a todos los enemigos.'), art: 'cicon_chain',
      effects: [{ k: 'damage', v: 4 }, { k: 'weak', v: 1, all: true }] },

    { id: 'venom_burst', name: DD.t('Estallido Venenoso'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 12,
      desc: DD.t('Inflige 7 de daño y aplica 5 de Veneno a todos los enemigos.'), art: 'cicon_venom',
      effects: [{ k: 'damage', v: 7 }, { k: 'poison', v: 5, all: true }] },

    { id: 'serum_of_ruin', name: DD.t('Suero de Ruina'), cost: 3, type: 'skill', rarity: 'rare', heat: 18,
      desc: DD.t('Aplica 10 de Veneno y 3 de Vulnerabilidad a todos los enemigos.'), art: 'cicon_serum',
      effects: [{ k: 'poison', v: 10, all: true }, { k: 'vulnerable', v: 3, all: true }] },

    /* frost_lance — criogénico */
    { id: 'lance_thrust', name: DD.t('Estocada de Lanza'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 9 de daño.'), art: 'cicon_frost',
      effects: [{ k: 'damage', v: 9 }] },

    { id: 'chill_spike', name: DD.t('Púa Gélida'), cost: 0, type: 'attack', rarity: 'common', heat: 3,
      desc: DD.t('Inflige 3 de daño y enfrías 3 de calor.'), art: 'cicon_crystal',
      effects: [{ k: 'damage', v: 3 }, { k: 'cool', v: 3, socket: null }] },

    { id: 'frostbite', name: DD.t('Congelación'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 12,
      desc: DD.t('Inflige 9 de daño y aplica 2 de Debilidad a todos los enemigos.'), art: 'cicon_frost',
      effects: [{ k: 'damage', v: 9 }, { k: 'weak', v: 2, all: true }] },

    { id: 'cryo_lance', name: DD.t('Lanza Criogénica'), cost: 3, type: 'attack', rarity: 'rare', heat: 20,
      desc: DD.t('Inflige 14 de daño, aplica 2 de Vulnerabilidad a todos los enemigos y enfrías 8 de calor.'),
      art: 'cicon_frost',
      effects: [{ k: 'damage', v: 14 }, { k: 'vulnerable', v: 2, all: true },
        { k: 'cool', v: 8, socket: null }] },

    /* hook_arm — mecánico */
    { id: 'hook_drag', name: DD.t('Garfio Arrastrador'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 7 de daño y aplica 1 de Debilidad a todos los enemigos.'), art: 'cicon_hook',
      effects: [{ k: 'damage', v: 7 }, { k: 'weak', v: 1, all: true }] },

    { id: 'chain_yank', name: DD.t('Tirón de Cadena'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 6 de daño y robas 1 carta.'), art: 'cicon_chain',
      effects: [{ k: 'damage', v: 6 }, { k: 'draw', v: 1 }] },

    { id: 'meat_hook', name: DD.t('Garfio Carnicero'), cost: 2, type: 'attack', rarity: 'uncommon', heat: 12,
      desc: DD.t('Inflige 8 de daño y aplica 4 de Sangrado a todos los enemigos.'), art: 'cicon_blood',
      effects: [{ k: 'damage', v: 8 }, { k: 'bleed', v: 4, all: true }] },

    { id: 'iron_maiden', name: DD.t('Doncella de Hierro'), cost: 3, type: 'block', rarity: 'rare', heat: 20,
      desc: DD.t('Ganas 5 de Bloqueo por cada 25 de calor en este socket.'), art: 'cicon_chain',
      effects: [{ k: 'gainBlockPerHeat', v: 5 }] },

    /* reaver_arm — osario, tier 3 signature */
    { id: 'bone_scythe', name: DD.t('Guadaña de Hueso'), cost: 2, type: 'attack', rarity: 'common', heat: 11,
      desc: DD.t('Inflige 13 de daño.'), art: 'cicon_hook',
      effects: [{ k: 'damage', v: 13 }] },

    { id: 'marrow_spray', name: DD.t('Rociada de Médula'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 4 de daño y aplica 2 de Sangrado a todos los enemigos.'), art: 'cicon_bone',
      effects: [{ k: 'damage', v: 4, all: true }, { k: 'bleed', v: 2, all: true }] },

    { id: 'reaper_toll', name: DD.t('Tañido del Segador'), cost: 3, type: 'attack', rarity: 'rare', heat: 22,
      desc: DD.t('Inflige 12 de daño y aplica 4 de Sangrado a todos los enemigos.'), art: 'cicon_skull',
      effects: [{ k: 'damage', v: 12, all: true }, { k: 'bleed', v: 4, all: true }] },

    { id: 'ossuary_ascendant', name: DD.t('Osario Ascendente'), cost: 2, type: 'power', rarity: 'rare', heat: 10,
      desc: DD.t('Inflige 12 de daño por cada miembro amputado y ganas 6 de residuo.'), art: 'cicon_graft',
      effects: [{ k: 'damagePerMissingLimb', v: 12 }, { k: 'residue', v: 6 }] },

    /* ---------- leg limbs ---------- */
    /* bone_stilts — osario */
    { id: 'stilt_step', name: DD.t('Paso de Zancos'), cost: 0, type: 'block', rarity: 'common', heat: 2,
      desc: DD.t('Ganas 4 de Bloqueo y enfrías 3 de calor.'), art: 'cicon_foot',
      effects: [{ k: 'block', v: 4 }, { k: 'cool', v: 3, socket: null }] },

    { id: 'march_of_bone', name: DD.t('Marcha de Hueso'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 6 de daño y ganas 3 de Bloqueo.'), art: 'cicon_spine',
      effects: [{ k: 'damage', v: 6 }, { k: 'block', v: 3 }] },

    { id: 'femur_throw', name: DD.t('Lanzamiento de Fémur'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 9 de daño.'), art: 'cicon_bone',
      effects: [{ k: 'damage', v: 9 }] },

    { id: 'knuckle_walk', name: DD.t('Marcha de Nudillos'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 4,
      desc: DD.t('Robas 2 cartas. Pierdes 3 PV.'), art: 'cicon_hand',
      effects: [{ k: 'draw', v: 2 }, { k: 'selfDamage', v: 3 }] },

    /* sinew_legs — visceral */
    { id: 'sprint', name: DD.t('Carrera Sanguínea'), cost: 0, type: 'skill', rarity: 'common', heat: 3,
      desc: DD.t('Ganas 1 de energía. Pierdes 2 PV.'), art: 'cicon_foot',
      effects: [{ k: 'energy', v: 1 }, { k: 'selfDamage', v: 2 }] },

    { id: 'tendon_snap', name: DD.t('Latigazo de Tendón'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 7 de daño. Te curas 3 PV.'), art: 'cicon_tendril',
      effects: [{ k: 'damage', v: 7 }, { k: 'lifesteal', v: 3 }] },

    { id: 'blood_marathon', name: DD.t('Maratón de Sangre'), cost: 2, type: 'power', rarity: 'uncommon', heat: 10,
      desc: DD.t('Te curas 8 PV y robas 1 carta.'), art: 'cicon_heart',
      effects: [{ k: 'heal', v: 8 }, { k: 'draw', v: 1 }] },

    /* spring_legs — mecánico */
    { id: 'spring_leap', name: DD.t('Salto de Muelle'), cost: 0, type: 'block', rarity: 'common', heat: 3,
      desc: DD.t('Ganas 5 de Bloqueo.'), art: 'cicon_gear',
      effects: [{ k: 'block', v: 5 }] },

    { id: 'pneumatic_kick', name: DD.t('Patada Neumática'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 8 de daño.'), art: 'cicon_steam',
      effects: [{ k: 'damage', v: 8 }] },

    { id: 'steam_exhaust', name: DD.t('Escape de Vapor'), cost: 0, type: 'skill', rarity: 'common', heat: 0,
      desc: DD.t('Enfrías 8 de calor.'), art: 'cicon_steam',
      effects: [{ k: 'cool', v: 8, socket: null }] },

    /* wraith_legs — espectral */
    { id: 'phase_step', name: DD.t('Paso Etéreo'), cost: 0, type: 'skill', rarity: 'common', heat: 3,
      desc: DD.t('Robas 1 carta y ganas 3 de Bloqueo.'), art: 'cicon_foot',
      effects: [{ k: 'draw', v: 1 }, { k: 'block', v: 3 }] },

    { id: 'wraith_dash', name: DD.t('Correría Espectral'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 7 de daño y robas 1 carta.'), art: 'cicon_lightning',
      effects: [{ k: 'damage', v: 7 }, { k: 'draw', v: 1 }] },

    { id: 'ecto_overflow', name: DD.t('Desborde Etéreo'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 7,
      desc: DD.t('Ganas 2 de energía, robas 1 carta y descartas 1 carta al azar.'), art: 'cicon_lightning',
      effects: [{ k: 'energy', v: 2 }, { k: 'draw', v: 1 }, { k: 'discardRandom', v: 1 }] },

    { id: 'void_stride', name: DD.t('Zancada del Vacío'), cost: 2, type: 'skill', rarity: 'uncommon', heat: 13,
      desc: DD.t('Robas 3 cartas y enfrías 8 de calor.'), art: 'cicon_crystal',
      effects: [{ k: 'draw', v: 3 }, { k: 'cool', v: 8, socket: null }] },

    /* acid_legs — alquímico */
    { id: 'acid_trail', name: DD.t('Rastro Ácido'), cost: 1, type: 'attack', rarity: 'common', heat: 5,
      desc: DD.t('Inflige 4 de daño y aplica 2 de Veneno a todos los enemigos.'), art: 'cicon_venom',
      effects: [{ k: 'damage', v: 4, all: true }, { k: 'poison', v: 2, all: true }] },

    { id: 'corrosive_step', name: DD.t('Paso Corrosivo'), cost: 1, type: 'attack', rarity: 'common', heat: 6,
      desc: DD.t('Inflige 6 de daño y aplica 1 de Vulnerabilidad a todos los enemigos.'), art: 'cicon_venom',
      effects: [{ k: 'damage', v: 6 }, { k: 'vulnerable', v: 1, all: true }] },

    { id: 'alembic_stride', name: DD.t('Zancada de Alambique'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 4,
      desc: DD.t('Ganas 8 de residuo y enfrías 4 de calor.'), art: 'cicon_serum',
      effects: [{ k: 'residue', v: 8 }, { k: 'cool', v: 4, socket: null }] },

    { id: 'toxic_runoff', name: DD.t('Vertido Tóxico'), cost: 2, type: 'skill', rarity: 'uncommon', heat: 12,
      desc: DD.t('Aplica 6 de Veneno y 2 de Debilidad a todos los enemigos.'), art: 'cicon_lung',
      effects: [{ k: 'poison', v: 6, all: true }, { k: 'weak', v: 2, all: true }] },

    /* frost_treads — criogénico, tier 3 signature */
    { id: 'permafrost_step', name: DD.t('Pisada de Permafrost'), cost: 1, type: 'block', rarity: 'common', heat: 5,
      desc: DD.t('Ganas 7 de Bloqueo y enfrías 5 de calor.'), art: 'cicon_frost',
      effects: [{ k: 'block', v: 7 }, { k: 'cool', v: 5, socket: null }] },

    { id: 'hail_stomp', name: DD.t('Pisotón de Granizo'), cost: 2, type: 'attack', rarity: 'common', heat: 12,
      desc: DD.t('Inflige 8 de daño y aplica 1 de Debilidad a todos los enemigos.'), art: 'cicon_foot',
      effects: [{ k: 'damage', v: 8, all: true }, { k: 'weak', v: 1, all: true }] },

    { id: 'winter_eternal', name: DD.t('Invierno Eterno'), cost: 3, type: 'power', rarity: 'rare', heat: 24,
      desc: DD.t('Enfrías 30 de calor, restauras 12 de integridad y ganas 8 de Bloqueo.'), art: 'cicon_crystal',
      effects: [{ k: 'cool', v: 30, socket: null }, { k: 'integrity', v: 12, socket: null },
        { k: 'block', v: 8 }] },

    { id: 'frozen_march', name: DD.t('Marcha Helada'), cost: 1, type: 'skill', rarity: 'uncommon', heat: 4,
      desc: DD.t('Ganas 1 de energía y enfrías 6 de calor.'), art: 'cicon_steam',
      effects: [{ k: 'energy', v: 1 }, { k: 'cool', v: 6, socket: null }] }
  ];

  DD.Data.cardById = {};
  for (var i = 0; i < DD.Data.cards.length; i++) DD.Data.cardById[DD.Data.cards[i].id] = DD.Data.cards[i];
})();
