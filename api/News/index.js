const axios = require('axios');
const cheerio = require('cheerio');
const { format } = require('date-fns');
const { ko } = require('date-fns/locale');
const iconv = require('iconv-lite');

// 오늘 날짜를 YYYYMMDD 형식으로 가져오는 함수
function getTodayDate() {
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
        // ⭐ 수정: responseType을 'arraybuffer'에서 'stream'으로 변경하여 데이터 처리 방식 개선
        // axios는 이 방식을 더 안정적으로 지원합니다.
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            responseType: 'stream'
        });

        // ⭐ 수정: 스트림을 버퍼로 변환하고 iconv-lite로 디코딩
        const chunks = [];
        response.data.on('data', (chunk) => chunks.push(chunk));
        await new Promise((resolve) => response.data.on('end', resolve));
        const buffer = Buffer.concat(chunks);
        const html = iconv.decode(buffer, 'EUC-KR');

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
