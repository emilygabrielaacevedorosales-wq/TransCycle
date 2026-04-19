# TransCycle — Checklist de validación MVP

## Pre-lanzamiento beta (completar antes de invitar usuarias)

### Seguridad
- [ ] JWT_SECRET generado con 64+ bytes aleatorios
- [ ] ENCRYPTION_MASTER_KEY generada con 32 bytes aleatorios
- [ ] DATABASE_URL apunta a BD de producción con SSL activado
- [ ] Variables de entorno fuera del repositorio (.env en .gitignore)
- [ ] Rate limiting verificado: auth 20 req/15min, global 100 req/15min
- [ ] Headers de seguridad (Helmet) activos en producción
- [ ] HTTPS obligatorio en producción (certificado SSL válido)
- [ ] Modo discreto probado en iOS y Android

### Base de datos
- [ ] Migración 001 ejecutada sin errores
- [ ] Los 6 drug_profiles están insertados (verificar: SELECT count(*) FROM drug_profiles)
- [ ] Backups automáticos configurados (mínimo diarios)
- [ ] Índices verificados con EXPLAIN ANALYZE en queries principales

### Algoritmo farmacocinético
- [ ] Tests Bloque 1: 20/20 pasando
- [ ] Tests Bloque 2: 24/24 pasando
- [ ] Tests Bloque 3: 21/21 pasando
- [ ] Revisión con endocrinólogo/a: parámetros t½ y Cmax validados
- [ ] Caso edge: usuaria que cambia régimen a mitad del ciclo → probar
- [ ] Caso edge: usuaria que saltea dosis → verificar que la curva decae correctamente
- [ ] Caso edge: primera vez sin historial → ciclo día 1 carga sin errores

### UX / Accesibilidad
- [ ] Flujo de onboarding completo probado (registro → primer medicamento → primera toma)
- [ ] Textos en español correctos (sin anglicismos innecesarios)
- [ ] Contraste de colores AA (herramienta: https://webaim.org/resources/contrastchecker/)
- [ ] Funciona en pantallas de 375px (iPhone SE)
- [ ] El modo discreto cambia nombre e ícono correctamente

### Legal y privacidad
- [ ] Política de privacidad redactada y accesible desde la app
- [ ] Términos de servicio redactados
- [ ] Consentimiento informado para uso de datos de salud (GDPR / ley local)
- [ ] Aviso: "Esta app no reemplaza la consulta médica"
- [ ] Proceso de eliminación de cuenta y datos documentado

---

## Protocolo de beta cerrada

### Reclutamiento (20–30 participantes)
- Comunidad trans latinoamericana (Reddit, grupos de Facebook, Discord)
- Criterio: usuarias activas en TRH con al menos 3 meses de tratamiento
- Diversidad de regímenes: incluir al menos 5 con valerato/cipionato IM
- Diversidad de proveedores de salud: pública y privada

### Duración
- Fase 1 (semanas 1–2): onboarding + registro de régimen existente
- Fase 2 (semanas 3–6): uso diario + registro de síntomas
- Fase 3 (semanas 7–8): validación del ciclo virtual vs. percepción propia

### Métricas de éxito beta
- Retención día 7: >60%
- Retención día 28: >35%
- Porcentaje de usuarias que registran síntomas ≥3 días/semana: >50%
- Satisfacción con el "ciclo virtual" (escala 1-5): media >3.5
- Bugs críticos reportados: 0 (seguridad/pérdida de datos)

### Recolección de feedback
- Formulario semanal (5 preguntas máximo)
- Canal de Discord privado para reportar bugs
- Entrevistas 1:1 al finalizar (30 min, voluntarias)

### Validación del algoritmo
- Comparar período fantasma predicho vs. reportado por usuaria
- Exactitud objetivo: ±3 días en el 70% de las usuarias
- Si la exactitud < 50%: revisar los parámetros de detección de ghost period

---

## Revisión con endocrinólogo/a

### Puntos a validar
1. Parámetros farmacocinéticos de E2_SUBLINGUAL (t½=3h, tmax=45min, Cmax=350pg/mL/mg)
2. Parámetros de P4_RECTAL (t½=20h, tmax=3.5h) vs. literatura actual
3. Modelo de supresión androgénica de espironolactona (canrenoato t½=16h)
4. Rangos de referencia para E2 en TRH trans (¿150–300 pg/mL es el objetivo típico?)
5. Interpretación del "ciclo virtual" — apropiada para comunicar a usuarias
6. Fraseología: ¿"ovulación virtual" es clínicamente apropiado?

### Disclaimer clínico obligatorio en la app
> "TransCycle es una herramienta de seguimiento personal.
>  Los niveles hormonales mostrados son estimaciones basadas en
>  modelos farmacocinéticos y no reemplazan exámenes de sangre.
>  Consulta siempre con tu médico o endocrinólogo/a antes de
>  modificar tu régimen de TRH."
