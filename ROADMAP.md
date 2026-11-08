# Kernel — Roadmap multiusuario

Estado actual: app personal (un solo usuario, contraseña en `APP_PASSWORD`).
Los datos ya se guardan por usuario (boards, lecturas, ideas propias), así que el cambio es incremental.

Antes de empezar: usarla unas semanas en kernel.yenexbw.com y anotar qué falta.

## Etapa 1 — Por invitación (10–30 personas)
- [ ] Registro con email + contraseña + código de invitación
- [ ] Mi cuenta actual pasa a ser admin (genera y revoca códigos) sin perder progreso
- [ ] Board "Saved", racha y progreso propios para cada usuario nuevo
- [ ] Perfil: nombre, meta diaria configurable (hoy fija en 5), idioma
- [ ] Recuperar contraseña por email (Resend o Postmark, plan gratis)
- [ ] Límite de intentos de login

## Etapa 2 — Público
- [ ] Registro libre con protección anti-bots
- [ ] Login con Google / Apple
- [ ] Contenido en español, inglés y japonés
- [ ] Borrar cuenta y descargar mis datos
- [ ] Política de privacidad y términos (APPI en Japón; GDPR si hay usuarios en Europa)
- [ ] Revisar licencia de Icons8 para uso público
- [ ] Respaldos automáticos de PostgreSQL en Railway

## Etapa 3 — Comunidad (estilo Deepstash)
- [ ] Publicar ideas propias para que otros las guarden
- [ ] Moderación: reportes y revisión
- [ ] Perfiles públicos, seguir usuarios, ideas más guardadas
- [ ] Opcional: modelo freemium

## Ideas pendientes de la app
- [ ] Repaso espaciado de ideas guardadas (1, 3, 7 y 21 días)
- [ ] "Lo hice" en la acción de "Try today"
- [ ] Notas personales por idea
