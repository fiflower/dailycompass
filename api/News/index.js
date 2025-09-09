const axios = require('axios');
const cheerio = require('cheerio');
const { format } = require('date-fns');
const { ko } = require('date-fns/locale');
const iconv = require('iconv-lite');

// 오늘 날짜를 YYYYMMDD 형식으로 가져오는 함수
function getTodayDate() {
    // KST (UTC+9) 기준 오늘 날짜
    const now = new Date();
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return format(kstDate, 'yyyyMMdd', { locale: ko });
}

module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a news request.');

    const dateStr = req.query.date || (req.params.date !== '*' && req.params.date) || getTodayDate();
    const url = `https://news.naver.com/main/list.naver?mode=LSD&mid=sec&sid1=105&date=${dateStr}`;
    
    context.log(`Fetching news from: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            // ★★★★★ 가장 중요한 변경점 ★★★★★
            // 1. 원본 데이터를 버퍼(날것) 형태로 받습니다.
            responseType: 'arraybuffer',
            // 2. 데이터를 받자마자 즉시 EUC-KR -> UTF-8로 변환합니다.
            transformResponse: [data => {
                return iconv.decode(data, 'EUC-KR');
            }]
        });

        // 이제 response.data는 완벽하게 변환된 한글 문자열입니다.
        const html = response.data;
        const $ = cheerio.load(html);
        const items = [];

        // 네이버 뉴스 페이지의 기사 목록 선택자 (headline 포함)
        $('ul.type06_headline li, ul.type06 li').each((index, element) => {
            const $element = $(element);
            const $a = $element.find('dl dt:not(.photo) a');
            
            if ($a.length > 0) {
                const title = $a.text().trim();
                const link = $a.attr('href');
                const press = $element.find('dl dd span.writing').text().trim();
                const time = $element.find('dl dd span.date').text().trim();

                items.push({
                    title,
                    link,
                    press,
                    time,
                    aid: link ? link.split('aid=')[1] : null
                });
            }
        });
        
        context.log(`Found ${items.length} news articles.`);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr, count: items.length, items: items })
        };

    } catch (error) {
        context.log.error('Error fetching or parsing news:', error);
        context.res = {
            status: 500,
            body: JSON.stringify({ error: 'Failed to fetch news', details: error.message })
        };
    }
};

