# Templates de email — Mukwatela

Use estes conteúdos em Supabase > Authentication > Emails > Templates. O projeto já usa SMTP personalizado, portanto a personalização de templates é suportada. Variáveis importantes: `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}`.

## Confirm signup
Subject: Confirme o seu email — Mukwatela

```html
<div style="margin:0;padding:32px 16px;background:#f4f1ea;font-family:Arial,sans-serif;color:#111827">
  <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e5e7eb">
    <div style="padding:28px 32px;background:#0d0d0d;color:#fff">
      <div style="font-size:26px;font-weight:800">MUKWATELA</div>
      <div style="margin-top:6px;color:#f5c32d;font-size:12px;letter-spacing:2px">COMÉRCIO E PRESTAÇÃO DE SERVIÇOS</div>
    </div>
    <div style="padding:34px 32px">
      <h1 style="margin:0 0 16px;font-size:28px">Confirme o seu email</h1>
      <p style="font-size:16px;line-height:1.6;color:#4b5563">Obrigado por criar a sua conta na Mukwatela. Confirme o seu endereço de email para ativar a conta.</p>
      <p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 22px;background:#f5c32d;color:#111827;text-decoration:none;font-weight:800">CONFIRMAR EMAIL</a></p>
      <p style="font-size:13px;line-height:1.6;color:#6b7280">Se não criou esta conta, pode ignorar esta mensagem.</p>
    </div>
    <div style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
      Mukwatela Comércio e Prestação de Serviços, SU, LDA<br>
      Xangongo – Ombadja – Cunene
    </div>
  </div>
</div>
```

## Reset password
Subject: Redefina a sua palavra-passe — Mukwatela

Use o mesmo layout e troque o botão para:
`<a href="{{ .ConfirmationURL }}">REDEFINIR PALAVRA-PASSE</a>`

Texto: "Recebemos um pedido para redefinir a palavra-passe da sua conta Mukwatela. Se foi você, utilize o botão abaixo. Se não solicitou esta alteração, ignore este email."

## Change email
Subject: Confirme a alteração do seu email — Mukwatela

Botão:
`<a href="{{ .ConfirmationURL }}">CONFIRMAR NOVO EMAIL</a>`

## Invite user
Subject: O seu acesso à Mukwatela

Botão:
`<a href="{{ .ConfirmationURL }}">ACEITAR CONVITE</a>`

## Nota
Não remover `{{ .ConfirmationURL }}` dos templates que precisam de link.