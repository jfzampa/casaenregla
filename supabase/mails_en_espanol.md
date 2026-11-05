# Mails de CasaEnRegla en español

> **Postergado**: Supabase solo permite editar las plantillas con un SMTP propio configurado.
> Se hace junto con el dominio propio (NIC Argentina) antes de la etapa 2. Mientras tanto, los mails salen en inglés.

Dónde se pegan: Supabase > **Authentication** > **Emails** > pestaña **Templates**.
Para cada uno: elegir el mail, reemplazar **Subject** (asunto) y **Message body** (cuerpo), y tocar **Save changes**.

---

## 1. Confirm signup (Confirmar registro)

**Subject:**
```
Confirmá tu cuenta de CasaEnRegla
```

**Message body:**
```html
<h2>¡Bienvenido/a a CasaEnRegla!</h2>
<p>Para activar tu cuenta, tocá este botón:</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#1f9d63;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Confirmar mi cuenta</a></p>
<p>Si no creaste una cuenta en CasaEnRegla, ignorá este mail.</p>
<p style="color:#66707d;font-size:12px">CasaEnRegla es una app privada. No pertenece a ARCA ni a ningún organismo público.</p>
```

---

## 2. Reset Password (Recuperar contraseña)

**Subject:**
```
Elegí tu contraseña nueva de CasaEnRegla
```

**Message body:**
```html
<h2>Contraseña nueva</h2>
<p>Pediste cambiar tu contraseña. Tocá este botón para elegir una nueva:</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#1f9d63;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Elegir contraseña nueva</a></p>
<p>Si no lo pediste vos, ignorá este mail: tu contraseña sigue siendo la misma.</p>
<p style="color:#66707d;font-size:12px">CasaEnRegla es una app privada. No pertenece a ARCA ni a ningún organismo público.</p>
```

---

## 3. Change Email Address (Cambiar email)

**Subject:**
```
Confirmá el cambio de email en CasaEnRegla
```

**Message body:**
```html
<h2>Cambio de email</h2>
<p>Pediste cambiar el email de tu cuenta de <b>{{ .Email }}</b> a <b>{{ .NewEmail }}</b>.</p>
<p><a href="{{ .ConfirmationURL }}" style="background:#1f9d63;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Confirmar el cambio</a></p>
<p>Si no lo pediste vos, ignorá este mail y avisanos.</p>
<p style="color:#66707d;font-size:12px">CasaEnRegla es una app privada. No pertenece a ARCA ni a ningún organismo público.</p>
```
