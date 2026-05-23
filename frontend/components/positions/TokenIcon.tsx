import React from 'react'

interface TokenIconProps {
  symbol: string
  className?: string
}

export function TokenIcon({ symbol, className = 'w-8 h-8' }: TokenIconProps) {
  const normSymbol = (symbol || '').toUpperCase()

  // Define gradients and SVGs for supported tokens
  let gradientClass = 'bg-gradient-to-br from-gray-400 to-gray-600'
  let emblem: React.ReactNode = null

  switch (normSymbol) {
    case 'ETH':
      gradientClass = 'bg-gradient-to-br from-[#627EEA] to-[#4D69DC]'
      emblem = (
        <svg viewBox="0 0 784 1277" className="w-3.5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <polygon points="392,0 383.5,29 383.5,873.5 392,882 784,652" />
          <polygon points="392,0 0,652 392,882 392,473" />
          <polygon points="392,956 387,962 387,1268 392,1277 784,726" />
          <polygon points="392,1277 392,956 0,726" />
          <polygon points="392,882 784,652 392,473" />
          <polygon points="392,473 0,652 392,882" />
        </svg>
      )
      break
    case 'WSTETH':
    case 'STETH':
      gradientClass = 'bg-gradient-to-br from-[#00A3FF] to-[#007BFF]'
      emblem = (
        <svg viewBox="0 0 784 1277" className="w-3.5 h-5 fill-white opacity-90" xmlns="http://www.w3.org/2000/svg">
          <polygon points="392,0 383.5,29 383.5,873.5 392,882 784,652" />
          <polygon points="392,0 0,652 392,882 392,473" />
          <polygon points="392,956 387,962 387,1268 392,1277 784,726" />
          <polygon points="392,1277 392,956 0,726" />
          <polygon points="392,882 784,652 392,473" />
          <polygon points="392,473 0,652 392,882" />
        </svg>
      )
      break
    case 'USDC':
      gradientClass = 'bg-gradient-to-br from-[#2775CA] to-[#1D5DA3]'
      emblem = (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.25 15.5h-2.5v-1.1c-1.39-.17-2.3-1.13-2.3-2.43h1.8c0 .66.45 1.09 1.15 1.09.73 0 1.12-.37 1.12-.89 0-1.28-3.52-.77-3.52-3.13 0-1.12.8-2.03 2.05-2.22V7.5h2.5v1.1c1.23.16 2.05 1.02 2.08 2.24h-1.8c-.03-.66-.46-1.02-1.13-1.02-.73 0-1.07.38-1.07.87 0 1.25 3.52.73 3.52 3.12 0 1.17-.83 2.05-2.15 2.22v1.1z"/>
        </svg>
      )
      break
    case 'USDT':
      gradientClass = 'bg-gradient-to-br from-[#26A17B] to-[#1E8564]'
      emblem = (
        <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white fill-none" strokeWidth="2.5" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M12 8v9M9 17h6" />
        </svg>
      )
      break
    case 'WBTC':
    case 'BTC':
      gradientClass = 'bg-gradient-to-br from-[#F7931A] to-[#DF8315]'
      emblem = (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.76 10.45c.42.3.69.75.69 1.4 0 1.25-.97 2.12-2.3 2.15v1h-1v-1h-1v1h-1v-1H9.5v-1h.65c.45 0 .6-.2.6-.6v-5.2c0-.4-.15-.6-.6-.6H9.5V7.5h1.65v-1h1v1h1v-1h1v1c1.23.03 2.13.78 2.13 1.95 0 .73-.38 1.3-.92 1.6l1.38 1.4zm-3.01-3.2v1.5h1c.4 0 .75-.2.75-.75s-.35-.75-.75-.75h-1zm0 2.8v1.7h1.15c.45 0 .8-.25.8-.85s-.35-.85-.8-.85H12.75z"/>
        </svg>
      )
      break
    case 'SOL':
      gradientClass = 'bg-gradient-to-br from-[#14F195] to-[#9945FF]'
      emblem = (
        <svg viewBox="0 0 398 344" className="w-3.5 h-3.5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.72 268.42h370.47c7.43 0 13.56-5.83 13.56-13.06 0-3.37-1.34-6.61-3.73-9.01L327.97 180.7a19.46 19.46 0 0 0-13.62-5.71H43.87c-7.43 0-13.56 5.83-13.56 13.06 0 3.37 1.34 6.61 3.73 9.01l66.05 65.65a19.45 19.45 0 0 0 13.63 5.71zM384.28 75.58H13.81c-7.43 0-13.56 5.83-13.56 13.06 0 3.37 1.34 6.61 3.73 9.01l66.05 65.65A19.45 19.45 0 0 0 83.66 169h270.47c7.43 0 13.56-5.83 13.56-13.06 0-3.37-1.34-6.61-3.73-9.01L297.91 81.28c-3.62-3.6-8.52-5.7-13.63-5.7zM327.97 9.29H43.88c-7.43 0-13.56 5.83-13.56 13.06 0 3.37 1.34 6.61 3.73 9.01l66.05 65.65a19.45 19.45 0 0 0 13.63 5.71h270.47c7.43 0 13.56-5.83 13.56-13.06 0-3.37-1.34-6.61-3.73-9.01L327.97 9.29z"/>
        </svg>
      )
      break
    case 'LINK':
      gradientClass = 'bg-gradient-to-br from-[#375BD2] to-[#2A48A5]'
      emblem = (
        <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white fill-none" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4L4 8v8l8 4 8-4V8l-8-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0 -6 0" />
        </svg>
      )
      break
    default:
      // General fallback using first letter
      gradientClass = 'bg-gradient-to-br from-[#8B5A2B] to-[#70655D] opacity-90'
      emblem = (
        <span className="text-[10px] font-bold text-white font-sans tracking-tighter">
          {symbol.slice(0, 2).toUpperCase()}
        </span>
      )
  }

  return (
    <div className={`${className} ${gradientClass} rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/10 select-none overflow-hidden`}>
      {emblem}
    </div>
  )
}
