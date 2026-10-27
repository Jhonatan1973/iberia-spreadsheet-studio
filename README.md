# Iberia Spreadsheet Studio

quero que voce faça um sistema aonde corpora isso, aonde eu possa colocar mexer nessa planilha de uma forma responsigo e bonita, layout relacioanda a espanha

## Compartilhar entre todos (Lovable Cloud)

Sem banco, o app salva só no navegador de quem usa (aparece o selo **"Só neste navegador"**).
Para os anexos e alterações aparecerem para todo mundo:

1. No editor do Lovable, ative o **Lovable Cloud** (ele cria `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`).
2. Edite `supabase/migrations/20261027120000_checklist_compartilhado.sql` e troque os e-mails de exemplo
   na tabela `membros` pelos e-mails reais de quem vai usar.
3. Peça ao Lovable: *"Rode a migração supabase/migrations/20261027120000_checklist_compartilhado.sql no Lovable Cloud"*.
4. Abra o app, clique em **"Primeira vez? Criar acesso"** com um dos e-mails da lista e entre.
5. Se você já tinha anexado coisas antes, vai aparecer **"Enviar para a nuvem"** — clique para subir o que estava no navegador.

Os arquivos ficam num bucket **privado**: só membros logados veem, por link temporário.
Para incluir alguém depois: `insert into public.membros (email) values ('pessoa@email.com');`

Os nomes das duas pessoas são trocados no próprio app, no botão **"Trocar nomes"** (ou no lápis ao lado do nome).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iberia-spreadsheet-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0c620564-bf95-46b8-8b3e-257d21518547).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
