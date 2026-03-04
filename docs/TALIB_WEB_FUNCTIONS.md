# talib-web function list and chart presets

Every function exported by **talib-web** (TA-Lib), categorized. Only **Overlay** and **Oscillator** entries are exposed as chart indicators in the app.

## Included as chart indicators (overlays & oscillators)

| Function | Category | Preset key | Notes |
|----------|----------|------------|--------|
| **Overlap / price** | | | |
| ACCBANDS | Overlap | accbands20 | Acceleration Bands (upper/middle/lower) |
| BBANDS | Overlap | bbands20 | Bollinger Bands |
| DEMA | Overlap | dema20 | Double EMA |
| EMA | Overlap | ema9, ema20 | Exponential MA |
| KAMA | Overlap | kama20 | Kaufman Adaptive MA |
| LINEARREG | Overlap | linearreg20 | Linear Regression |
| MAMA | Overlap | mama | MESA Adaptive MA (MAMA + FAMA) |
| MIDPOINT | Overlap | midpoint14 | Midpoint over period |
| MIDPRICE | Overlap | midprice14 | Midpoint Price (high/low) |
| SAR | Overlap | psar | Parabolic SAR |
| SAREXT | Overlap | sarext | Parabolic SAR Extended |
| SMA | Overlap | sma20 | Simple MA |
| T3 | Overlap | t3_5 | T3 Moving Average |
| TEMA | Overlap | tema20 | Triple EMA |
| TRIMA | Overlap | trima30 | Triangular MA |
| TSF | Overlap | tsf14 | Time Series Forecast |
| WMA | Overlap | wma20 | Weighted MA |
| **Volatility (overlay)** | | | |
| ATR | Volatility | atr14 | Average True Range |
| NATR | Volatility | natr14 | Normalized ATR |
| **Price transform (overlay)** | | | |
| AVGPRICE | Price | avgprice | (O+H+L+C)/4 |
| MEDPRICE | Price | medprice | (H+L)/2 |
| TYPPRICE | Price | typprice | (H+L+C)/3 |
| WCLPRICE | Price | wclprice | (H+L+C*2)/4 |
| **Momentum (oscillator)** | | | |
| ADX | Momentum | adx14 | Average Directional Index |
| ADXR | Momentum | adxr14 | ADX Rating |
| APO | Momentum | apo | Absolute Price Oscillator |
| AROON | Momentum | aroon14 | Aroon (up/down) |
| AROONOSC | Momentum | aroonosc14 | Aroon Oscillator |
| CCI | Momentum | cci20 | Commodity Channel Index |
| CMO | Momentum | cmo14 | Chande Momentum Oscillator |
| DX | Momentum | dx14 | Directional Movement Index |
| IMI | Momentum | imi14 | Intraday Momentum Index |
| MINUS_DI | Momentum | minusDi14 | Minus Directional Indicator |
| MOM | Momentum | mom10 | Momentum |
| PLUS_DI | Momentum | plusDi14 | Plus Directional Indicator |
| PPO | Momentum | ppo | Percentage Price Oscillator |
| ROC | Momentum | roc12 | Rate of Change |
| ROCP | Momentum | rocp10 | ROC Percentage |
| RSI | Momentum | rsi14 | Relative Strength Index |
| TRIX | Momentum | trix15 | TRIX |
| ULTOSC | Momentum | ultosc | Ultimate Oscillator |
| WILLR | Momentum | williamsR14 | Williams %R |
| **Trend (oscillator)** | | | |
| LINEARREG_ANGLE | Statistic | linearregAngle14 | Lin Reg Angle |
| LINEARREG_SLOPE | Statistic | linearregSlope14 | Lin Reg Slope |
| **Volume (oscillator)** | | | |
| AD | Volume | adl | Chaikin A/D Line |
| ADOSC | Volume | adosc | Chaikin A/D Oscillator |
| MFI | Volume | mfi14 | Money Flow Index |
| OBV | Volume | obv | On Balance Volume |
| **MACD / Stochastic (oscillator)** | | | |
| MACD | Momentum | macd | MACD (12,26,9) |
| MACDFIX | Momentum | macdfix | MACD Fix 12/26 |
| STOCH | Momentum | stochastic | Stochastic Slow |
| STOCHF | Momentum | stochasticFast | Stochastic Fast |
| STOCHRSI | Momentum | stochasticRsi | Stochastic RSI |
| **Other (oscillator)** | | | |
| BOP | Momentum | bop | Balance of Power |

**Custom (not TA-Lib):** VWAP — computed in-app.

---

## Excluded (not used as chart indicators)

**Math / trig:** ACOS, ASIN, ATAN, CEIL, COS, COSH, EXP, FLOOR, LN, LOG10, SIN, SINH, SQRT, TAN, TANH  

**Math operators:** ADD, DIV, MULT, SUB, SUM  

**Statistic (no chart use):** AVGDEV, BETA, CORREL, STDDEV, VAR  

**Min/Max/Index:** MAX, MAXINDEX, MIN, MININDEX, MINMAX, MINMAXINDEX  

**Candlestick patterns** (return integer signals ±100/0, not a line):  
CDL2CROWS, CDL3BLACKCROWS, CDL3INSIDE, CDL3LINESTRIKE, CDL3OUTSIDE, CDL3STARSINSOUTH, CDL3WHITESOLDIERS, CDLABANDONEDBABY, CDLADVANCEBLOCK, CDLBELTHOLD, CDLBREAKAWAY, CDLCLOSINGMARUBOZU, CDLCONCEALBABYSWALL, CDLCOUNTERATTACK, CDLDARKCLOUDCOVER, CDLDOJI, CDLDOJISTAR, CDLDRAGONFLYDOJI, CDLENGULFING, CDLEVENINGDOJISTAR, CDLEVENINGSTAR, CDLGAPSIDESIDEWHITE, CDLGRAVESTONEDOJI, CDLHAMMER, CDLHANGINGMAN, CDLHARAMI, CDLHARAMICROSS, CDLHIGHWAVE, CDLHIKKAKE, CDLHIKKAKEMOD, CDLHOMINGPIGEON, CDLIDENTICAL3CROWS, CDLINNECK, CDLINVERTEDHAMMER, CDLKICKING, CDLKICKINGBYLENGTH, CDLLADDERBOTTOM, CDLLONGLEGGEDDOJI, CDLLONGLINE, CDLMARUBOZU, CDLMATCHINGLOW, CDLMATHOLD, CDLMORNINGDOJISTAR, CDLMORNINGSTAR, CDLONNECK, CDLPIERCING, CDLRICKSHAWMAN, CDLRISEFALL3METHODS, CDLSEPARATINGLINES, CDLSHOOTINGSTAR, CDLSHORTLINE, CDLSPINNINGTOP, CDLSTALLEDPATTERN, CDLSTICKSANDWICH, CDLTAKURI, CDLTASUKIGAP, CDLTHRUSTING, CDLTRISTAR, CDLUNIQUE3RIVER, CDLUPSIDEGAP2CROWS, CDLXSIDEGAP3METHODS  

**Hilbert (niche):** HT_DCPERIOD, HT_DCPHASE, HT_PHASOR, HT_SINE, HT_TRENDLINE, HT_TRENDMODE  

**Other (variable period / not standard indicator):** MA (generic MA), MAVP (variable period), MACDEXT (configurable MA types), ROCR, ROCR100  

**Total talib-web functions:** ~165. **Chart presets:** 56 (25 overlays + 31 oscillators, including custom VWAP).
