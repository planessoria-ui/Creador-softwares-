# Diseño de producto: "Responsable de Cumplimiento Normativo Virtual" para PYMEs

SaaS no-code que automatiza la generación, actualización y vigilancia de documentación legal/normativa para pequeñas y medianas empresas, funcionando como un compliance officer externo sin intervención humana diaria.

---

## 1. Problema y disposición a pagar

**Quién sufre el problema:** micro y pequeñas empresas (1-50 empleados) en sectores con obligaciones normativas pero sin presupuesto para un responsable de cumplimiento ni una asesoría jurídica recurrente: clínicas/centros de estética, gimnasios, inmobiliarias, e-commerce, agencias de marketing, academias, despachos, restaurantes, constructoras.

**El dolor concreto:**
- Necesitan documentación legal viva (política de privacidad, aviso legal, política de cookies, RAT de RGPD, DPA con proveedores, plan de prevención de riesgos, plan de igualdad y canal de denuncias si superan 50 empleados) que casi nunca se actualiza tras la firma inicial.
- Cuando cambia la normativa (LOPDGDD, Ley 2/2023 de protección al informante, actualizaciones RGPD/AEPD) nadie revisa si sus documentos siguen siendo válidos.
- Los plazos de renovación (auditorías anuales, evaluaciones de riesgo, registros) se olvidan y generan sanciones.
- La alternativa actual es cara y lenta: notaría/gestoría/abogado cobra por consulta puntual (cientos-miles de €) y no da seguimiento continuo.

**Por qué pagarían mensualmente:** una cuota fija y predecible (49-199€/mes) es infinitamente más barata que una sanción de la AEPD (mínimo 2.000€, hasta 20M€ en casos graves) o que contratar horas de abogado bajo demanda. El valor percibido es "tranquilidad + evitar multas", no "documentos bonitos".

---

## 2. Producto (funcionalidades núcleo)

1. **Onboarding inteligente**: cuestionario (sector, país, nº empleados, tipo de datos tratados, canales digitales) → la IA genera el paquete inicial de documentos personalizado.
2. **Generador de documentos legales**: aviso legal, política de privacidad, cookies, RAT/RGPD, DPA con proveedores, manual del empleado, plan de prevención de riesgos, plan de igualdad, canal de denuncias.
3. **Calendario de cumplimiento y alertas**: vencimientos de auditorías, renovaciones, obligaciones por tramo de empleados.
4. **Vigilancia normativa por IA**: monitoriza BOE/DOUE, detecta cambios relevantes por sector y genera automáticamente una propuesta de actualización del documento afectado.
5. **Portal del cliente**: panel con "semáforo de cumplimiento" (verde/ámbar/rojo) por documento.
6. **Registro de proveedores/subencargados** (para RGPD).
7. **Micro-formación de empleados** con certificado de finalización (evidencia para auditorías).
8. **Exportación de auditoría**: histórico y versión de cada documento, listo para inspección.
9. **Escalado a humano (upsell)**: red de abogados colaboradores para casos complejos (comisión o fee fijo).

---

## 3. Stack no-code para construirlo sin escribir código

| Capa | Herramienta | Función |
|---|---|---|
| Frontend / portal cliente | **Bubble.io** o **Softr** (sobre Supabase/Airtable) | Onboarding, dashboard, semáforo de cumplimiento |
| Base de datos | **Supabase** o **Airtable** | Clientes, documentos, vencimientos, suscripciones |
| Motor de IA | **API de Claude/OpenAI** vía Make.com/n8n | Redacción y actualización de documentos a partir de plantillas |
| Maquetación de documentos | **Documint** o **PandaDoc** | Combina el output de IA en PDF/Word con marca del cliente |
| Orquestación/automatización | **Make.com** (o **n8n** self-hosted si escala) | Conecta formulario → IA → documento → email → CRM |
| Pagos y suscripción | **Stripe Billing** (o **Lemon Squeezy** como Merchant of Record para IVA UE) | Cobro recurrente, dunning automático |
| Email/lifecycle | **Customer.io** o Make.com + SendGrid | Alertas de vencimiento, onboarding drip, recuperación de churn |
| Base de conocimiento legal | **Notion** o **Airtable** | "Fuente de verdad" de cláusulas, actualizada manualmente de forma puntual |
| Vigilancia normativa | Módulo RSS/scraper en Make.com/n8n + IA de resumen | Lee BOE/DOUE y clasifica relevancia por sector |
| Soporte | **Crisp**/**Intercom Fin AI** | Chatbot de primer nivel entrenado con la base legal |
| Firma electrónica (opcional) | **Dropbox Sign** / **SignWell** | Firma de documentos que lo requieran |
| Analítica interna | Airtable/Google Sheets + **Looker Studio** | MRR, churn, LTV en tiempo real |

---

## 4. Automatizaciones para operar sin tu presencia diaria

1. **Alta de cliente**: formulario → Make.com crea registro → dispara generación IA del paquete inicial → genera PDFs → sube al portal → email de bienvenida con acceso, todo sin intervención humana.
2. **Cobro recurrente**: suscripción Stripe automática; reintentos y emails de dunning ante impago; cancelación/downgrade automático tras fallos repetidos.
3. **Vigilancia normativa continua**: cron semanal que revisa fuentes oficiales, la IA resume y clasifica el impacto por sector, y si aplica a un cliente activo genera un borrador de actualización que el cliente aprueba con un clic.
4. **Recordatorios de vencimiento**: motor de calendario que revisa fechas críticas y dispara secuencias de email (30/15/7/1 día antes) sin que tengas que revisarlo.
5. **Onboarding y retención**: secuencia de emails automatizada que reduce el abandono temprano y empuja checkpoints ("¿ya revisaste tu documento X?").
6. **Upsell automático por señales**: si el cliente actualiza su nº de empleados y cruza un umbral legal (p. ej. 50 empleados), la IA sugiere activar módulos nuevos (plan de igualdad, canal de denuncias) y genera la oferta de upgrade.
7. **Soporte de primer nivel**: chatbot con base de conocimiento legal responde 24/7 y solo escala a un humano (tú o un freelance) los casos realmente complejos.
8. **Reporting**: dashboard automático de MRR/churn/LTV que se actualiza solo, sin trabajo manual de tu parte.
9. **Versionado y backup**: cada documento generado se versiona automáticamente para trazabilidad ante una inspección.

Tu única intervención periódica real sería curar de vez en cuando (mensual, no diaria) la biblioteca maestra de cláusulas legales — algo que puedes delegar a un abogado freelance por horas.

---

## 5. Estimación realista de MRR (mes 3 y mes 6)

**Supuestos de precio:**
- Starter: 49€/mes (documentos básicos)
- Growth: 99€/mes (RGPD completo + calendario)
- Pro: 199€/mes (plan de igualdad, canal de denuncias, soporte prioritario)
- ARPU medio ponderado estimado: **~90-95€/mes**

**Supuestos de adquisición** (fundador solo, bootstrapped, marketing de contenidos + outreach en LinkedIn/asociaciones de PYMEs, sin gran inversión en ads):

| Escenario | Nuevos clientes/mes (mes 1-3) | Churn mensual | Clientes activos mes 3 | MRR mes 3 |
|---|---|---|---|---|
| Conservador | 5-8 | 8% | ~18-25 | ~1.700-2.300€ |
| Base | 8-15 | 6-7% | ~25-40 | ~2.300-3.700€ |
| Optimista | 15-20 | 5% | ~40-50 | ~3.800-4.700€ |

| Escenario | Nuevos clientes/mes (mes 4-6) | Churn mensual | Clientes activos mes 6 | MRR mes 6 |
|---|---|---|---|---|
| Conservador | 8-12 | 7% | ~45-60 | ~4.200-5.700€ |
| Base | 15-25 | 6% | ~90-120 | ~8.500-11.500€ |
| Optimista | 25-35 | 5% | ~150-180 | ~14.500-17.500€ |

**Lectura honesta:** el escenario "base" es el más plausible para un producto nicho, bootstrapped, con un solo fundador operando el stack no-code: **MRR mes 3 ≈ 2.500-3.500€** y **MRR mes 6 ≈ 8.500-11.000€**. Llegar al escenario optimista requiere tracción temprana vía comunidades/asociaciones sectoriales o un cambio normativo que dispare la urgencia de compra (efecto habitual en compliance SaaS). Los primeros 4-6 semanas probablemente sean pre-ingreso mientras se valida el producto con clientes piloto (ideal: 3-5 clientes beta a precio reducido a cambio de casos de uso/testimonios antes de escalar adquisición).
