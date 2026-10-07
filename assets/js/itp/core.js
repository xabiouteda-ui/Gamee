// Calculadora del ITP de vehículos usados. La parte de cálculo no usa el DOM y se prueba con Node (tests/unit-itp.mjs).
/* Lógica de cálculo del ITP de vehículos usados. Normativa 2026.
   Fuentes: Orden HAC/1501/2025 (Anexo IV), "Tributación Autonómica. Medidas 2026" (Hacienda),
   guía oficial de la Administración Tributaria de Aragón (mayo 2026). */
var ITP = (function () {
  var COEF = [100, 84, 67, 56, 47, 39, 34, 28, 24, 19, 17, 13, 10];

  function edad(fechaMatric, fechaVenta) {
    var a = new Date(fechaMatric), b = new Date(fechaVenta);
    if (isNaN(a) || isNaN(b) || b < a) return null;
    var anios = b.getFullYear() - a.getFullYear();
    var cumplido = (b.getMonth() > a.getMonth()) || (b.getMonth() === a.getMonth() && b.getDate() >= a.getDate());
    if (!cumplido) anios -= 1;
    var exacta = (b - a) / (365.2425 * 864e5);
    return { completos: anios, exacta: exacta };
  }

  function coeficiente(aniosCompletos) {
    return COEF[Math.min(Math.max(aniosCompletos, 0), 12)];
  }

  function pct(rate, nota) { return { tipo: "pct", rate: rate, nota: nota || "" }; }
  function fija(amount, nota, sinTramite) { return { tipo: "fija", amount: amount, nota: nota || "", sinTramite: !!sinTramite }; }

  // v: { tipoVeh: turismo|moto|ciclomotor, cc, cvf, etiqueta: cero|eco|otra, historico, edad (años, decimal), base }
  var REGLAS = {
    andalucia: { nombre: "Andalucía", fn: function (v) {
      if (v.etiqueta === "cero") return pct(1, "Tipo reducido del 1 % para vehículos con etiqueta 0 emisiones.");
      if (v.tipoVeh === "turismo" && v.cvf > 15) return pct(8, "Tipo incrementado del 8 % para turismos y todoterrenos de más de 15 caballos fiscales.");
      return pct(4);
    }},
    aragon: { nombre: "Aragón", fn: function (v) {
      if (!v.historico && v.edad > 10) {
        if (v.cc <= 1000) return fija(0, "Más de 10 años y hasta 1.000 cc: no pagas ni tienes que presentar autoliquidación (salvo que necesites el código CET para Tráfico).", true);
        if (v.cc <= 1500) return fija(20, "Cuota fija para vehículos de más de 10 años entre 1.001 y 1.500 cc.");
        if (v.cc <= 2000) return fija(30, "Cuota fija para vehículos de más de 10 años entre 1.501 y 2.000 cc.");
      }
      return pct(4);
    }},
    asturias: { nombre: "Asturias", fn: function (v) {
      if (v.tipoVeh === "turismo" && v.cvf > 15) return pct(8, "Tipo incrementado del 8 % para turismos y todoterrenos de más de 15 caballos fiscales.");
      return pct(4);
    }},
    baleares: { nombre: "Illes Balears", fn: function (v) {
      if (v.tipoVeh === "ciclomotor") return fija(0, "Los ciclomotores tributan al 0 % y no hay que presentar autoliquidación.", true);
      if (v.etiqueta === "cero") return pct(0, "Tipo del 0 % para vehículos con etiqueta 0 emisiones.");
      if (v.etiqueta === "eco") return pct(2, "Tipo del 2 % para vehículos con etiqueta ECO.");
      if (v.tipoVeh === "turismo" && v.cvf > 15) return pct(8, "Tipo del 8 % para turismos y todoterrenos de más de 15 caballos fiscales.");
      return pct(4);
    }},
    canarias: { nombre: "Canarias", fn: function (v) {
      if (v.tipoVeh === "turismo" && !v.historico && v.edad > 10) {
        if (v.cc <= 1000) return fija(40, "Cuota fija para turismos de más de 10 años hasta 1.000 cc.");
        if (v.cc <= 1500) return fija(70, "Cuota fija para turismos de más de 10 años entre 1.001 y 1.500 cc.");
        if (v.cc <= 2000) return fija(115, "Cuota fija para turismos de más de 10 años entre 1.501 y 2.000 cc.");
      }
      return pct(5.5);
    }},
    cantabria: { nombre: "Cantabria", fn: function () {
      return pct(6, "Cantabria aplica además unas cuotas mínimas según antigüedad y cilindrada. Si el 6 % te sale muy bajo, comprueba en la Agencia Cántabra de Administración Tributaria si te corresponde la cuota mínima.");
    }},
    clm: { nombre: "Castilla-La Mancha", fn: function () { return pct(6); } },
    cyl: { nombre: "Castilla y León", fn: function (v) {
      if (v.tipoVeh === "turismo" && v.cvf > 15) return pct(8, "Tipo incrementado del 8 % para turismos y todoterrenos de más de 15 caballos fiscales.");
      return pct(5);
    }},
    cataluna: { nombre: "Cataluña", fn: function () { return pct(5); } },
    valencia: { nombre: "Comunitat Valenciana", fn: function (v) {
      var limpio = v.etiqueta === "cero" || (v.etiqueta === "eco" && v.cc < 2000);
      if (!v.historico && v.base < 20000 && v.edad > 5) {
        var tablaTur = v.edad > 12 ? [40, 60, 140] : [120, 180, 280];
        var tablaMoto = v.edad > 12 ? [10, 20, 35, 55] : [30, 60, 90, 140];
        var tramo = v.edad > 12 ? "más de 12 años" : "entre 5 y 12 años";
        if (v.tipoVeh === "turismo") {
          var i = v.cc <= 1500 ? 0 : v.cc <= 2000 ? 1 : 2;
          return fija(tablaTur[i], "Cuota fija para turismos de " + tramo + " con valor inferior a 20.000 €, según cilindrada.");
        }
        var j = v.cc <= 250 ? 0 : v.cc <= 550 ? 1 : v.cc <= 750 ? 2 : 3;
        return fija(tablaMoto[j], "Cuota fija para motos y ciclomotores de " + tramo + " con valor inferior a 20.000 €, según cilindrada.");
      }
      if (limpio) return pct(6, "Los eléctricos e híbridos de menos de 2.000 cc tributan al 6 % sea cual sea su valor.");
      if ((v.edad <= 5 && v.cc > 2000) || v.base >= 20000) return pct(8, "Tipo incrementado del 8 %: vehículo de hasta 5 años con más de 2.000 cc, o valor igual o superior a 20.000 €.");
      return pct(6);
    }},
    extremadura: { nombre: "Extremadura", fn: function () { return pct(6); } },
    galicia: { nombre: "Galicia", fn: function (v) {
      if (v.etiqueta === "cero") return pct(0, "Tipo del 0 % para vehículos con etiqueta 0 emisiones.");
      if (v.tipoVeh === "turismo" && v.edad >= 15) {
        if (v.cc <= 1199) return fija(22, "Cuota fija para turismos de 15 años o más hasta 1.199 cc.");
        if (v.cc <= 1599) return fija(38, "Cuota fija para turismos de 15 años o más entre 1.200 y 1.599 cc.");
      }
      return pct(3);
    }},
    madrid: { nombre: "Comunidad de Madrid", fn: function () { return pct(4); } },
    murcia: { nombre: "Región de Murcia", fn: function (v) {
      if (!v.historico && v.edad > 12) {
        if (v.cc <= 1000) return fija(0, "Más de 12 años y hasta 1.000 cc: no pagas ni tienes que presentar autoliquidación.", true);
        if (v.cc <= 1500) return fija(30, "Cuota fija para vehículos de más de 12 años entre 1.001 y 1.500 cc.");
        if (v.cc <= 2000) return fija(50, "Cuota fija para vehículos de más de 12 años entre 1.501 y 2.000 cc.");
        return fija(75, "Cuota fija para vehículos de más de 12 años de más de 2.000 cc. Este tramo no lo hemos podido contrastar con la norma oficial: confírmalo en la Agencia Tributaria de la Región de Murcia.");
      }
      return pct(4);
    }},
    rioja: { nombre: "La Rioja", fn: function () { return pct(4); } },
    ceuta: { nombre: "Ceuta", fn: function () { return pct(4, "Ceuta tiene una bonificación del 50 % en la cuota, ya aplicada en el resultado."); } },
    melilla: { nombre: "Melilla", fn: function () { return pct(4, "Melilla tiene una bonificación del 50 % en la cuota, ya aplicada en el resultado."); } },
    paisvasco: { nombre: "País Vasco", foral: true },
    navarra: { nombre: "Navarra", foral: true }
  };
  // bonificación para Ceuta y Melilla
  REGLAS.ceuta.bonif = 0.5; REGLAS.melilla.bonif = 0.5;

  function calcular(d) {
    var r = REGLAS[d.ccaa];
    if (!r) return { error: "Elige una comunidad autónoma." };
    if (r.foral) return { foral: true, nombre: r.nombre };
    var e = edad(d.fechaMatric, d.fechaVenta);
    if (!e) return { error: "Revisa las fechas: la de compra tiene que ser posterior a la de primera matriculación." };
    var precio = Math.max(0, +d.precio || 0);
    var coef = coeficiente(e.completos);
    var valorTablas = +d.valorTablas || 0;
    var valorFiscal = valorTablas > 0 ? Math.round(valorTablas * coef) / 100 : null;
    var base = Math.max(precio, valorFiscal || 0);
    var v = { tipoVeh: d.tipoVeh, cc: +d.cc || 0, cvf: +d.cvf || 0, etiqueta: d.etiqueta, historico: !!d.historico, edad: e.exacta, base: base };
    var regla = r.fn(v);
    var cuota;
    if (regla.tipo === "fija") cuota = regla.amount;
    else {
      cuota = base * regla.rate / 100;
      if (r.bonif) cuota = cuota * (1 - r.bonif);
    }
    cuota = Math.round(cuota * 100) / 100;
    return {
      nombre: r.nombre, edadCompletos: e.completos, edadExacta: e.exacta, coef: coef,
      precio: precio, valorTablas: valorTablas, valorFiscal: valorFiscal, base: base,
      regla: regla, bonif: r.bonif || 0, cuota: cuota, usaTablas: valorFiscal !== null && valorFiscal > precio
    };
  }

  return { calcular: calcular, coeficiente: coeficiente, edad: edad, COEF: COEF, REGLAS: REGLAS };
})();
export const { calcular, coeficiente, edad, COEF, REGLAS } = ITP;
export default ITP;

