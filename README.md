# NeuroLedger

Sistema local de controle de gastos com visual futurista monocromático (preto + branco), glassmorphism forte e gráficos SVG.

## Recursos

- Entradas e saídas com data e valor
- Contas para pagar e receber com vencimento
- Visão mensal por seletor de mês
- Somatórios automáticos (entradas, saídas, saldo projetado)
- Gráfico de fluxo mensal + sparklines sutis
- Persistência local via `localStorage`
- Ícones 100% SVG inline (sem emojis)

## Rodar local

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (`http://localhost:5173` por padrão).

## Build de produção

```bash
npm run build
npm run preview
```

## Stack

- React + Vite + TypeScript
- Tailwind plugin configurado no Vite
- CSS custom para identidade sci-fi premium
