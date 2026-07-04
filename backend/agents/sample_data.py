"""Bundled sample filings so the demo works without hitting SEC EDGAR."""
from __future__ import annotations

SAMPLES: list[dict] = [
    {
        "ticker": "AAPL",
        "company_name": "Apple Inc.",
        "source": "10-Q FY24 Q3 (excerpt)",
        "text": """Apple Inc. — Form 10-Q — Quarter ended June 29, 2024

Management's Discussion and Analysis

Total net sales for the third quarter of fiscal 2024 were $85.8 billion, an increase of 5% or $4.0 billion compared to the same quarter last year. Products net sales were $61.6 billion, up 2% year-over-year, driven by higher iPhone and iPad sales. Services net sales set a new all-time record of $24.2 billion, an increase of 14% year-over-year.

iPhone revenue was $39.3 billion, essentially flat versus the prior-year quarter, reflecting continued strength in emerging markets. Mac revenue increased 2% to $7.0 billion. iPad revenue grew 24% to $7.2 billion, boosted by the launch of the new iPad Pro and iPad Air. Wearables, Home and Accessories declined 2% to $8.1 billion.

Gross margin was 46.3%, up 130 basis points from 45.0% in the year-ago quarter. Products gross margin was 35.3%, and Services gross margin reached 74.0%. Operating income for the quarter was $25.4 billion, representing an operating margin of 29.6%. Net income was $21.4 billion, or $1.40 per diluted share, compared to $19.9 billion or $1.26 per diluted share in the prior-year quarter, representing 11% EPS growth.

Cash flow from operations totaled $28.9 billion for the quarter. During the quarter, Apple returned approximately $32.3 billion to shareholders through $23.6 billion of share repurchases and $3.9 billion of dividends. The company ended the quarter with $61.8 billion in cash and marketable securities net of debt.

Guidance and Outlook

Management expects total revenue growth to accelerate modestly in the September quarter, driven by continued Services strength and initial contributions from generative AI features expected to ship later this calendar year. Foreign exchange headwinds are expected to have a low-single-digit percentage negative impact on the September quarter. Gross margin is expected to be between 45.5% and 46.5%. Operating expenses are expected to be between $14.2 billion and $14.4 billion.

Risk Factors (Updated)

The company continues to face macroeconomic uncertainty, particularly in Greater China where revenue declined 6.5% year-over-year to $14.7 billion. Regulatory risk remains elevated, including the ongoing Digital Markets Act obligations in the European Union which have already required App Store changes and could pressure Services growth. Supply-chain concentration in East Asia and geopolitical tensions between the United States and China are ongoing risks. Foreign currency volatility remains a headwind given more than 50% of revenue is generated outside the United States.

Segment Highlights

Services segment continues to be the growth engine, with paid subscriptions across the platform exceeding 1 billion, more than double the number four years ago. The installed base of active devices reached an all-time high in every geographic segment and product category.""",
    },
    {
        "ticker": "AAPL",
        "company_name": "Apple Inc.",
        "source": "Earnings Call Q3 FY24 (excerpt)",
        "text": """Apple Q3 FY24 Earnings Call — Prepared Remarks (excerpt)

CEO Tim Cook: "We are very pleased to report a June-quarter revenue record of $85.8 billion, up 5% year-over-year. We set an all-time revenue record in Services, and we saw stronger performance in emerging markets, including a new June-quarter record in India. Our installed base of active devices reached an all-time high in every geography, and customer satisfaction remains extremely high."

On Apple Intelligence: "This is one of the most exciting product cycles we've ever had. Apple Intelligence will roll out with iOS 18.1 in US English later this year, with more languages and features to follow. We believe these features will be a compelling reason for customers to upgrade."

On China: "Greater China revenue was $14.7 billion. On a constant-currency basis, revenue was down mid-single digits. We remain committed to the market and continue to invest for the long term."

CFO Luca Maestri: "We generated $28.9 billion in operating cash flow. We returned over $32 billion to shareholders during the quarter. Our net cash position is $61.8 billion, and we remain committed to net cash neutral over time."

On guidance: "For the September quarter, we expect revenue to grow year-over-year at a similar rate to the June quarter. We expect gross margin between 45.5% and 46.5%. Services should continue to grow double digits."

Q&A Highlights

Analyst on AI monetization: Cook declined to comment on whether Apple would charge for AI features but noted that Apple Intelligence "will require iPhone 15 Pro or later, and Macs and iPads with M1 or later."

Analyst on iPhone cycle: Maestri noted that iPhone revenue was flat, but the company expects the September quarter to benefit from the new iPhone launch. Emerging markets, especially India, are cited as continued growth drivers.

Analyst on regulatory: Cook acknowledged EU Digital Markets Act compliance costs but said the impact on financials is "not material in the near term."
""",
    },
    {
        "ticker": "MSFT",
        "company_name": "Microsoft Corporation",
        "source": "10-Q FY24 Q4 (excerpt)",
        "text": """Microsoft Corporation — Form 10-Q — Quarter ended June 30, 2024

Financial Highlights

Revenue for the fourth quarter of fiscal 2024 was $64.7 billion, an increase of 15% compared to the prior-year quarter. Operating income was $27.9 billion, up 15% year-over-year, representing an operating margin of 43.1%. Net income was $22.0 billion, or $2.95 per diluted share, up 10% year-over-year.

Segment Performance

Productivity and Business Processes revenue was $20.3 billion, up 11%, driven by Microsoft 365 Commercial cloud revenue growth of 13% and LinkedIn revenue growth of 10%.

Intelligent Cloud revenue was $28.5 billion, up 19% year-over-year. Azure and other cloud services revenue grew 29% (30% in constant currency), with approximately 8 percentage points of growth attributable to AI services. Server products and cloud services revenue increased 21%.

More Personal Computing revenue was $15.9 billion, up 14%, including a 44% increase from Activision Blizzard, which was acquired in October 2023. Windows OEM revenue increased 4%. Devices revenue decreased 11%.

Capital Expenditures

Cash paid for property and equipment was $19.0 billion in the fourth quarter, more than double the $10.7 billion in the prior-year quarter. Full-year capital expenditures were $55.7 billion. Management expects capital expenditures to be higher in fiscal 2025 as the company continues to invest in AI infrastructure to meet growing demand.

Outlook (fiscal Q1 2025 guidance)

- Productivity and Business Processes: revenue growth of 9% to 11% in constant currency.
- Intelligent Cloud: revenue growth of 18% to 20% in constant currency; Azure growth of 28% to 29% in constant currency.
- More Personal Computing: revenue between $14.9 billion and $15.3 billion.
- Company total revenue: $63.8 billion to $64.8 billion.

Risk Factors

AI capacity constraints continue to limit the pace at which Azure AI revenue can be recognized. The company expects capacity to expand meaningfully in the second half of fiscal 2025. Competitive dynamics in AI remain intense across cloud and productivity software. Regulatory scrutiny of AI and cloud practices in the US, EU, and UK is elevated. The Activision Blizzard integration continues but has depressed Xbox content and services margins.

CFO Amy Hood commentary: "We remain focused on delivering strong operating leverage as we scale AI. FY25 operating margins will be down only about one point year-over-year despite significant AI infrastructure investment."
""",
    },
    {
        "ticker": "NVDA",
        "company_name": "NVIDIA Corporation",
        "source": "10-Q FY25 Q1 (excerpt)",
        "text": """NVIDIA Corporation — Form 10-Q — Quarter ended April 28, 2024

Financial Highlights

Revenue for the first quarter of fiscal 2025 was $26.0 billion, up 262% year-over-year and up 18% sequentially. Data Center revenue was a record $22.6 billion, up 427% year-over-year, driven by demand for the Hopper GPU computing platform used for training and inference of large language models, recommendation engines, and generative AI.

GAAP operating income was $16.9 billion, and GAAP net income was $14.9 billion, or $5.98 per diluted share. On a non-GAAP basis, net income was $15.2 billion, or $6.12 per diluted share.

GAAP gross margin was 78.4%, up from 64.6% in the prior-year quarter. Operating margin was 64.9%. Free cash flow was $15.0 billion.

Segment Results

Data Center: $22.6 billion (+427% YoY). Compute revenue was up 478% YoY driven by shipments of the H100 and H200 Tensor Core GPUs. Networking revenue was up 242% YoY, boosted by InfiniBand end-to-end solutions.

Gaming: $2.6 billion (+18% YoY), reflecting healthy demand for RTX 40 series GPUs.

Professional Visualization: $427 million (+45% YoY).

Automotive: $329 million (+11% YoY), driven by AI cockpit solutions.

Guidance for Q2 FY25

- Revenue expected to be $28.0 billion, plus or minus 2%.
- GAAP gross margin expected to be 74.8%, plus or minus 50 basis points.
- GAAP operating expenses expected to be approximately $4.0 billion.
- Free cash flow expected to remain strong.

Management commentary

CEO Jensen Huang: "The next industrial revolution has begun. Companies and countries are partnering with NVIDIA to shift the trillion-dollar traditional data centers to accelerated computing and build a new type of data center — AI factories — to produce a new commodity: artificial intelligence."

Blackwell platform: Sampling now, with production shipments in Q2 FY25 and broad availability in the second half of the fiscal year. Demand for Blackwell is well ahead of supply and expected to remain so well into next year.

Risk factors

Supply constraints for GPUs remain the primary near-term risk to Data Center revenue. Customer concentration is elevated with a small number of hyperscalers accounting for approximately 45% of Data Center revenue. Export controls to China remain a headwind and could tighten further. Competition from custom AI accelerators (Google TPU, AWS Trainium, Microsoft Maia) may intensify. Geopolitical tensions in Taiwan pose a manufacturing continuity risk given TSMC concentration.
""",
    },
]
