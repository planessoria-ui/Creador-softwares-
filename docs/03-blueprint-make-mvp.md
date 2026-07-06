# C) Blueprint técnico del MVP en Make.com (módulo a módulo)

Objetivo: montar el flujo que convierte un formulario en documentación legal entregada, cobrada y con seguimiento, **sin que tú toques nada cada día**. Empieza en modo "conserje" (semi-manual) y auto­matiza a medida que llegan clientes.

## Arquitectura general

```
[Landing/Tally] → [Stripe cobro] → [Make: onboarding] → [IA genera] → [PDF] → [Portal + Email]
                                                                                      ↓
                              [Make: cron semanal vigilancia normativa] → [borrador update]
                                                                                      ↓
                              [Make: cron diario vencimientos] → [emails de aviso]
```

Herramientas mínimas del MVP: **Tally** (formulario) · **Stripe** (cobro) · **Make.com** (orquestación) · **API de Claude** (redacción) · **Google Docs/Docs API o Documint** (PDF) · **Airtable** (base de datos) · **Gmail/SendGrid** (email) · **Softr** (portal, se añade en fase 2).

---

## ESCENARIO 1 — Onboarding y generación de documentos

**Disparador:** `Stripe > Watch Events` → evento `checkout.session.completed` (solo generas cuando han pagado).

| # | Módulo | Configuración |
|---|---|---|
| 1 | **Stripe › Watch Events** | Filtra `checkout.session.completed`. Recupera email y metadata del cliente. |
| 2 | **Tally / Airtable › Search Records** | Busca las respuestas del onboarding por email para traer sector, nº empleados, tipo de datos, canales. |
| 3 | **Airtable › Create a Record** | Crea el registro del cliente (estado = "Generando"). |
| 4 | **Router** | Bifurca por tipo de documento a generar (privacidad, aviso legal, cookies, RAT...). |
| 5 | **Anthropic Claude › Create a Message** (HTTP si no hay módulo nativo) | Prompt = plantilla maestra del documento + variables del cliente. Modelo: `claude-opus-4-8` para calidad legal (o `claude-haiku-4-5` para borradores baratos). Ver prompt base abajo. |
| 6 | **Google Docs › Create from Template** *(o Documint)* | Inserta el texto de la IA en una plantilla con marca. Genera el PDF. |
| 7 | **Google Drive › Upload** | Guarda el PDF en la carpeta del cliente. |
| 8 | **Airtable › Update Record** | Guarda URL del documento + versión + fecha. Estado = "Listo". |
| 9 | **Gmail/SendGrid › Send Email** | Email de bienvenida con acceso al portal y sus documentos. |

> **Modo conserje (semanas 1-6):** ejecuta este escenario "a mano" desde Make para tus 3-5 betas y revisa tú el output antes de enviarlo. Cuando confíes en la calidad, ponlo en automático.

### Prompt base para el módulo de IA (módulo 5)
```
Eres un experto en cumplimiento normativo español (RGPD/LOPDGDD). Redacta un/a
[TIPO_DOCUMENTO] para una empresa con estos datos:
- Sector: {{sector}}
- Nº de empleados: {{empleados}}
- Datos que trata: {{tipos_de_datos}}
- Canales digitales: {{canales}}
- País/jurisdicción: {{pais}}

Usa como base la siguiente plantilla maestra revisada por abogado y personalízala.
NO inventes obligaciones que no apliquen. Marca entre [CORCHETES] cualquier dato
que falte y deba completar el cliente. Devuelve solo el texto final del documento.

PLANTILLA MAESTRA:
{{plantilla_del_documento}}
```

---

## ESCENARIO 2 — Vigilancia normativa (cron semanal)

**Disparador:** `Schedule` → una vez por semana.

| # | Módulo | Configuración |
|---|---|---|
| 1 | **Schedule** | Lunes 08:00. |
| 2 | **HTTP / RSS › Watch** | Lee fuentes oficiales (BOE por materia, novedades AEPD, DOUE). |
| 3 | **Anthropic Claude › Create a Message** | "Resume estos cambios normativos y clasifica su impacto (alto/medio/nulo) por sector: {{sectores_de_mis_clientes}}." |
| 4 | **Filter** | Continúa solo si impacto = alto o medio. |
| 5 | **Airtable › Search Records** | Clientes afectados por ese sector/materia. |
| 6 | **Iterator** | Uno por cliente afectado. |
| 7 | **Anthropic Claude › Create a Message** | Genera un borrador de actualización del documento afectado de ese cliente. |
| 8 | **Airtable › Update Record** | Guarda el borrador como "pendiente de aprobación" + pone el semáforo del doc en ÁMBAR. |
| 9 | **Gmail › Send Email** | "Ha cambiado la normativa que te afecta. Revisa y aprueba la actualización con un clic." |

---

## ESCENARIO 3 — Recordatorios de vencimiento (cron diario)

**Disparador:** `Schedule` → diario.

| # | Módulo | Configuración |
|---|---|---|
| 1 | **Schedule** | Diario 07:00. |
| 2 | **Airtable › Search Records** | Vencimientos con fecha en 30 / 15 / 7 / 1 días. |
| 3 | **Router + Filters** | Un ramal por cada umbral de días. |
| 4 | **Gmail › Send Email** | Secuencia de aviso correspondiente. |
| 5 | **Airtable › Update Record** | Marca "aviso enviado" para no duplicar. |

---

## ESCENARIO 4 — Cobro recurrente y churn (lo gestiona Stripe, tú solo escuchas)

- **Stripe Billing** se encarga del cobro mensual, reintentos y dunning automáticamente. No necesitas escenario para el cobro en sí.
- Escenario opcional en Make: `Stripe › Watch Events` → `customer.subscription.deleted` → Airtable update (estado = "Baja") + Gmail secuencia de recuperación de churn.

---

## Modelo de datos en Airtable (tablas mínimas)

- **Clientes:** email, negocio, sector, nº empleados, tipos de datos, canales, estado, fecha alta, plan.
- **Documentos:** cliente (link), tipo, versión, URL PDF, fecha generación, semáforo (verde/ámbar/rojo), borrador pendiente.
- **Vencimientos:** cliente (link), tipo obligación, fecha límite, avisos enviados.
- **Cambios normativos:** fecha, fuente, resumen, impacto, sectores afectados.

---

## Orden de construcción recomendado
1. **Semana 1-2:** Tally + Stripe Payment Link + Airtable + Escenario 1 en modo conserje (tú revisas). Ya puedes cobrar y entregar.
2. **Semana 3-4:** Escenario 3 (vencimientos) y automatizar Escenario 1.
3. **Mes 2:** Portal en Softr conectado a Airtable (semáforo visible para el cliente) + Escenario 2 (vigilancia).
4. **Mes 3:** Escenario 4 (churn) + micro-formación + refinar prompts con feedback real.

> **Riesgo #1 a cubrir antes de cobrar:** que un abogado revise tus plantillas maestras (las que van en `{{plantilla_del_documento}}`). La IA personaliza sobre ellas; si la base es sólida, el output es fiable. Presupuesta unas horas de un jurista freelance.
