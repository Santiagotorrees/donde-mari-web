// Donde Mari - catálogo y pedidos (aplicativo web estático)
// Lógica 100 % en el navegador: carga el catálogo JSON, gestiona el carrito
// con localStorage y genera el pedido como mensaje de WhatsApp.

const CLAVE_CARRITO = 'dm_carrito_v1';
const CLAVE_EDAD = 'dm_mayor_edad';

const estado = {
  tienda: null,
  categorias: [],
  productos: [],
  filtro: 'todas',
  busqueda: '',
  orden: 'relevancia',
  carrito: cargarCarrito()
};

const $ = (sel) => document.querySelector(sel);
const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const pesos = (v) => formatoCOP.format(v);

// ---------- Persistencia ----------
function cargarCarrito() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
    return datos && typeof datos === 'object' ? datos : {};
  } catch {
    return {};
  }
}

function guardarCarrito() {
  try {
    localStorage.setItem(CLAVE_CARRITO, JSON.stringify(estado.carrito));
  } catch { /* almacenamiento no disponible: el carrito vive en memoria */ }
}

// ---------- Utilidades ----------
function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function avisar(mensaje) {
  const aviso = $('#aviso');
  aviso.textContent = mensaje;
  aviso.classList.add('aviso--visible');
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => aviso.classList.remove('aviso--visible'), 1800);
}

function tiendaAbierta(fecha = new Date()) {
  const { abre, cierra } = estado.tienda.horario;
  const hora = fecha.getHours();
  return hora >= abre && hora < cierra;
}

// ---------- Catálogo ----------
function productosVisibles() {
  const termino = normalizar(estado.busqueda.trim());
  let lista = estado.productos.filter((p) =>
    (estado.filtro === 'todas' || p.categoria === estado.filtro) &&
    (!termino || normalizar(p.nombre).includes(termino))
  );
  const ordenes = {
    'precio-asc': (a, b) => a.precio - b.precio,
    'precio-desc': (a, b) => b.precio - a.precio,
    'nombre': (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    'relevancia': (a, b) => Number(b.destacado) - Number(a.destacado) || a.id - b.id
  };
  return lista.sort(ordenes[estado.orden]);
}

function renderFiltros() {
  const cont = $('#filtros');
  const todas = [{ id: 'todas', nombre: 'Todas' }, ...estado.categorias];
  cont.innerHTML = todas.map((c) => `
    <button class="chip ${c.id === estado.filtro ? 'chip--activo' : ''}" role="tab"
      aria-selected="${c.id === estado.filtro}" data-cat="${c.id}">${escaparHTML(c.nombre)}</button>`).join('');
}

function renderCatalogo() {
  const lista = productosVisibles();
  $('#sin-resultados').hidden = lista.length > 0;
  $('#grilla').innerHTML = lista.map((p) => {
    const cant = estado.carrito[p.id] || 0;
    return `
    <article class="tarjeta">
      ${p.destacado ? '<span class="etiqueta">Destacado</span>' : ''}
      <div class="tarjeta__imagen" aria-hidden="true">${p.emoji}</div>
      <h3>${escaparHTML(p.nombre)}</h3>
      <p class="precio">${pesos(p.precio)}</p>
      ${cant > 0
        ? `<div class="cantidad" data-id="${p.id}">
             <button data-accion="restar" aria-label="Quitar uno">−</button>
             <span>${cant}</span>
             <button data-accion="sumar" aria-label="Agregar uno">+</button>
           </div>`
        : `<button class="btn btn--bloque" data-agregar="${p.id}">Agregar</button>`}
    </article>`;
  }).join('');
}

// ---------- Carrito ----------
function cambiarCantidad(id, delta) {
  const actual = estado.carrito[id] || 0;
  const nueva = Math.max(0, Math.min(99, actual + delta));
  if (nueva === 0) delete estado.carrito[id];
  else estado.carrito[id] = nueva;
  guardarCarrito();
  renderTodo();
}

function calcularTotales() {
  const items = Object.entries(estado.carrito)
    .map(([id, cant]) => ({ producto: estado.productos.find((p) => p.id === Number(id)), cant }))
    .filter((i) => i.producto);
  const subtotal = items.reduce((s, i) => s + i.producto.precio * i.cant, 0);
  const { costoDomicilio, domicilioGratisDesde } = estado.tienda;
  const domicilio = subtotal === 0 || subtotal >= domicilioGratisDesde ? 0 : costoDomicilio;
  const unidades = items.reduce((s, i) => s + i.cant, 0);
  return { items, subtotal, domicilio, total: subtotal + domicilio, unidades };
}

function renderCarrito() {
  const { items, subtotal, domicilio, total, unidades } = calcularTotales();
  $('#contador-carrito').textContent = unidades;
  $('#carrito-vacio').hidden = items.length > 0;
  $('#form-pedido').hidden = items.length === 0;
  $('#lista-carrito').innerHTML = items.map(({ producto: p, cant }) => `
    <li class="item">
      <span class="item__emoji" aria-hidden="true">${p.emoji}</span>
      <div class="item__info">
        <strong>${escaparHTML(p.nombre)}</strong>
        <small>${pesos(p.precio)} c/u</small>
      </div>
      <div class="cantidad cantidad--peq" data-id="${p.id}">
        <button data-accion="restar" aria-label="Quitar uno">−</button>
        <span>${cant}</span>
        <button data-accion="sumar" aria-label="Agregar uno">+</button>
      </div>
      <span class="item__total">${pesos(p.precio * cant)}</span>
    </li>`).join('');
  $('#subtotal').textContent = pesos(subtotal);
  $('#domicilio').textContent = domicilio === 0 && subtotal > 0 ? 'Gratis' : pesos(domicilio);
  $('#total').textContent = pesos(total);
}

function renderTodo() {
  renderCatalogo();
  renderCarrito();
}

function abrirCarrito(abrir) {
  $('#panel-carrito').classList.toggle('panel--abierto', abrir);
  $('#panel-carrito').setAttribute('aria-hidden', String(!abrir));
  $('#fondo').hidden = !abrir;
}

// ---------- Pedido ----------
export function construirMensaje(datos, totales) {
  const lineas = totales.items.map(({ producto: p, cant }) => `• ${cant} x ${p.nombre} = ${pesos(p.precio * cant)}`);
  return [
    `*Nuevo pedido - ${estado.tienda.nombre}*`,
    '',
    ...lineas,
    '',
    `Subtotal: ${pesos(totales.subtotal)}`,
    `Domicilio: ${totales.domicilio === 0 ? 'Gratis' : pesos(totales.domicilio)}`,
    `*Total: ${pesos(totales.total)}*`,
    '',
    `Nombre: ${datos.nombre}`,
    `Celular: ${datos.celular}`,
    `Dirección: ${datos.direccion} (${datos.barrio})`,
    `Pago: ${datos.pago}`,
    datos.notas ? `Notas: ${datos.notas}` : ''
  ].filter((l, i, arr) => !(l === '' && i === arr.length - 1)).join('\n');
}

function validarFormulario(form) {
  const datos = Object.fromEntries(new FormData(form).entries());
  Object.keys(datos).forEach((k) => { datos[k] = String(datos[k]).trim(); });
  if (!datos.nombre || !datos.direccion || !datos.barrio) return { error: 'Completa nombre, dirección y barrio.' };
  if (!/^3\d{9}$/.test(datos.celular)) return { error: 'El celular debe tener 10 dígitos y empezar por 3.' };
  return { datos };
}

function enviarPedido(evento) {
  evento.preventDefault();
  const totales = calcularTotales();
  const error = $('#error-form');
  if (totales.items.length === 0) return;
  if (totales.subtotal < 15000) { error.textContent = 'El pedido mínimo es de $15.000.'; return; }
  const { datos, error: msg } = validarFormulario(evento.target);
  if (msg) { error.textContent = msg; return; }
  error.textContent = '';
  const url = `https://wa.me/${estado.tienda.whatsapp}?text=${encodeURIComponent(construirMensaje(datos, totales))}`;
  window.open(url, '_blank', 'noopener');
  avisar('Abriendo WhatsApp para confirmar tu pedido…');
}

// ---------- Eventos ----------
function registrarEventos() {
  $('#filtros').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    estado.filtro = btn.dataset.cat;
    renderFiltros();
    renderCatalogo();
  });

  $('#buscador').addEventListener('input', (e) => { estado.busqueda = e.target.value; renderCatalogo(); });
  $('#orden').addEventListener('change', (e) => { estado.orden = e.target.value; renderCatalogo(); });

  document.addEventListener('click', (e) => {
    const agregar = e.target.closest('[data-agregar]');
    if (agregar) {
      cambiarCantidad(Number(agregar.dataset.agregar), 1);
      avisar('Producto agregado al carrito');
      return;
    }
    const accion = e.target.closest('[data-accion]');
    if (accion) {
      const id = Number(accion.closest('[data-id]').dataset.id);
      cambiarCantidad(id, accion.dataset.accion === 'sumar' ? 1 : -1);
    }
  });

  $('#btn-carrito').addEventListener('click', () => abrirCarrito(true));
  $('#cerrar-carrito').addEventListener('click', () => abrirCarrito(false));
  $('#fondo').addEventListener('click', () => abrirCarrito(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirCarrito(false); });

  $('#vaciar').addEventListener('click', () => {
    estado.carrito = {};
    guardarCarrito();
    renderTodo();
  });
  $('#form-pedido').addEventListener('submit', enviarPedido);

  $('#edad-si').addEventListener('click', () => {
    try { localStorage.setItem(CLAVE_EDAD, '1'); } catch { /* sin almacenamiento */ }
    $('#modal-edad').hidden = true;
  });
  $('#edad-no').addEventListener('click', () => {
    window.location.href = 'https://www.google.com';
  });
}

function verificarEdad() {
  let confirmado = false;
  try { confirmado = localStorage.getItem(CLAVE_EDAD) === '1'; } catch { /* sin almacenamiento */ }
  $('#modal-edad').hidden = confirmado;
}

function renderInfoTienda() {
  const { abre, cierra } = estado.tienda.horario;
  $('#texto-horario').textContent = `Todos los días de ${abre}:00 a ${cierra}:00.`;
  $('#texto-domicilio').textContent =
    `${pesos(estado.tienda.costoDomicilio)} — gratis en pedidos desde ${pesos(estado.tienda.domicilioGratisDesde)}. ${estado.tienda.zonas}`;
  const abierta = tiendaAbierta();
  const badge = $('#estado-tienda');
  badge.textContent = abierta ? 'Abierto ahora' : 'Cerrado ahora';
  badge.className = `estado ${abierta ? 'estado--abierto' : 'estado--cerrado'}`;
  $('#anio').textContent = new Date().getFullYear();
}

// ---------- Inicio ----------
async function iniciar() {
  try {
    const resp = await fetch('data/productos.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const datos = await resp.json();
    estado.tienda = datos.tienda;
    estado.categorias = datos.categorias;
    estado.productos = datos.productos;
  } catch (err) {
    $('#grilla').innerHTML = '<p class="error">No fue posible cargar el catálogo. Intenta de nuevo más tarde.</p>';
    console.error('Error cargando catálogo:', err);
    return;
  }
  renderInfoTienda();
  renderFiltros();
  renderTodo();
  registrarEventos();
  verificarEdad();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

iniciar();
