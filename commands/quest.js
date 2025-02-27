import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js'
import { Cluster } from 'puppeteer-cluster'

export const data = new SlashCommandBuilder()
	.setName('q')
	.setDescription('Search quest on wiki')
	.addStringOption(option =>
		option.setName('keywords')
			.setDescription('What do you want to search?')
			.setRequired(true)
	)
export async function execute(interaction) {
	const search = interaction.options.getString('keywords')

    const loadingImg = new AttachmentBuilder('./assets/eft-escape-from-tarkov-small.gif')
	await interaction.reply({ content: 'Search in progress for: ' + search, files:[loadingImg] })

    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,
        puppeteerOptions: {
            headless: true,
            userDataDir: './../userDataDir'
        }
    });

    cluster.queue('https://escapefromtarkov.fandom.com/fr/wiki/Sp%C3%A9cial:Recherche?fulltext=1&query=' + search);

    await cluster.task(async ({ page, data: url }) => {
        
        await page.setRequestInterception(true);

        let requestHandler = (request) => {
            if (['image', 'stylesheet', 'font', 'script', 'media', 'object', 'sub_frame'].indexOf(request.resourceType()) !== -1) {
                request.abort()
            } else {
                request.continue()
            }
        }

        page.on('request', requestHandler);

        // Set screen size
        //await page.setViewport({width: 1920, height: 1080})

        // Navigate the page to a URL
        await page.goto(url)

        // Wait and click on first result
        let getQuestPage = false
        let elSearchResultSelector = await page.$x('//a[@class="unified-search__result__title"]')
        const elSearchResultSelectorLenght = elSearchResultSelector.length

        for (let i = 0; i < elSearchResultSelectorLenght; i++) {
            const el = elSearchResultSelector[i];

            if(!el) {
                return false;
            }
        
            await el.focus()
        
            await Promise.all([
                page.waitForNavigation({ timeout: 10000 }),
                page.keyboard.type('\n')
            ]);
        
            // Check if it's a quest
            const elCat = await page.$x('//tr[@id="va-infobox0-content"]//th[@class="va-infobox-header"][text()="Informations de la quête"]')
        
            // If not go back to search
            if(elCat.length == 0) {
                await Promise.all([
                    page.waitForNavigation({ timeout: 10000 }),
                    page.goBack()
                ]);
                elSearchResultSelector = await page.$x('//a[@class="unified-search__result__title"]')
            } else {
                getQuestPage = true
                break
            }
        }

        if(!getQuestPage) {
            // Edit reply with embed
            await interaction.editReply({ content: 'Sorry bro, no result found for: ' + search, files: [] })
            return false
        }

        // Locate the main title
        await page.waitForSelector('.mw-page-title-main')
        const elementMainTitle = await page.$('.mw-page-title-main')
        const mainTitle = await elementMainTitle.evaluate(el => el.textContent)

        // Locate thumb img
        const thumbImgSelector = '.va-infobox-mainimage-image img'
        const thumbImgElement = await page.$(thumbImgSelector)
        const thumbImg = await thumbImgElement.evaluate(el => el.getAttribute('data-src') ? el.getAttribute('data-src') : el.getAttribute('src'))

        // Retrieve current url 
        const currentUrl = page.url()

        // Get conditions
        const elConditionsText = await page.$x('//span[@id="Conditions"]/../following-sibling::*[1]')
        let conditionsText
        if(elConditionsText.length >= 1) {
            conditionsText = await page.evaluate(el => el.textContent, elConditionsText[0])
        }

        // Get objectifs
        const elObjectifsText = await page.$x('//span[@id="Objectifs"]/../following-sibling::*[1]')
        const objectifsText = await page.evaluate(el => el.textContent, elObjectifsText[0])

        // Get guide text
        const elGuideText = await page.$x('//span[@id="Guide"]/../following-sibling::p[1] | //span[@id="Guide"]/../following-sibling::ul[1]')
        let guideText = ''
        if(elGuideText.length >= 1) {
            for (let i = 0; i < elGuideText.length; i++) {
                const el = elGuideText[i];
                guideText += '\n' +  await page.evaluate(el => el.textContent, elGuideText[i])
            }

            // Check guideText isn't above 1024char
            if(guideText.length > 1024) {
                guideText = guideText.substring(0, 1020)
                guideText = guideText + '...'
            }
        }
        
        // Get type
        const elType = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"][text()="Type"]/following-sibling::td[@class="va-infobox-content"]')
        let typeTxt
        if (elType[0]) {
            typeTxt = await page.evaluate(el => el.innerText, elType[0])
        }

        // Get zone
        const elZone = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"][text()="Zone"]/following-sibling::td[@class="va-infobox-content"]')
        let zoneTxt
        if(elZone.length >= 1) {
            zoneTxt = await page.evaluate(el => el.textContent, elZone[0])
        }

        // Get given by
        const elGivenBy = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"][text()="Donnée par"]/following-sibling::td[@class="va-infobox-content"]/a')
        let givenByTxt
        if (elGivenBy[0]) {
            givenByTxt = await page.evaluate(el => el.textContent, elGivenBy[0])
        }

        // Get Kappa
        const elKappa = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"]/a[text()="Kappa"]/../following-sibling::td[@class="va-infobox-content"]/font')
        let kappaTxt
        if (elKappa[0]) {
            kappaTxt = await page.evaluate(el => el.textContent, elKappa[0])
        }

        // Get prev quest

        // Get next quest

        // Check if it's a gunsmith quest
        let gunsmithImg
        const isItGS = mainTitle.search("Armurier")
        if(typeTxt == "Personnalisation d'arme" || isItGS >= 0) {
            typeTxt = "Personnalisation d'arme"

            // reload page without restrictions
            page.off('request', requestHandler);
            requestHandler = (request) => {
                if (['media', 'object', 'sub_frame'].indexOf(request.resourceType()) !== -1) {
                    request.abort()
                } else {
                    request.continue()
                }
            }
            page.on('request', requestHandler);

            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }),
                page.reload()
            ]);

            // Click on cookie prompt
            await page.waitForSelector('div[data-tracking-opt-in-reject="true"]')
            const cookieEl = await page.$('div[data-tracking-opt-in-reject="true"]')
            if(cookieEl) {
                await page.click('div[data-tracking-opt-in-reject="true"]')
            }

            // remove site notice
            let sitenoticeContainer= ".sitenotice-wrapper";
            await page.evaluate((sel) => {
                var elements = document.querySelectorAll(sel);
                for(var i=0; i< elements.length; i++){
                    elements[i].parentNode.removeChild(elements[i]);
                }
            }, sitenoticeContainer)

            // add css to imprve final screenshot
            await page.addStyleTag({content: '.wds-tab__content.wds-is-current{background:black;position:absolute;top:0;z-index:9999999;}'})

            // get table element
            const gunsmithTableEl = await page.$('.wds-tab__content.wds-is-current')
            // scroll to element
            await page.evaluate((el) => { el.scrollIntoView(); }, gunsmithTableEl);
            await new Promise(r => setTimeout(r, 1750));
            // take screenshot
            gunsmithImg = await gunsmithTableEl.screenshot({
                encoding: 'binary'
            })
        }

        // Get images
        const elImage = await page.$x('//ul[@class="gallery mw-gallery-packed"]//a[@class="image"][1]')
        let imageUrl
        let file
        if(elImage.length >= 1) {
            imageUrl = await page.evaluate(el => el.getAttribute('href'), elImage[0])
        } else if(gunsmithImg) {
            file = new AttachmentBuilder(gunsmithImg, { name: search.replace(' ','-') + '.png' })
            imageUrl = 'attachment://' + search.replace(' ','-') + '.png'
        }

        // Create embed
        let wikiEmbed = new EmbedBuilder()
            .setTitle(mainTitle)
            .setURL(currentUrl)
            .setThumbnail(thumbImg)
            .setDescription(objectifsText)
            .setColor('#9a8866')

        if(guideText) {
            wikiEmbed.addFields({ name: 'Guide', value: guideText })
        }
            
        wikiEmbed.addFields(
            { name: 'Type', value: typeTxt ? typeTxt : '-', inline: true },
            { name: 'Zone', value: zoneTxt ? zoneTxt : '-', inline: true },
            { name: 'Donnée par', value: givenByTxt ? givenByTxt : '-', inline: true },
            { name: 'Kappa', value: kappaTxt ? kappaTxt : '-', inline: true },
        )

        if(conditionsText) {
            wikiEmbed.setFooter({ text: conditionsText })
        }

        if(imageUrl) {
            wikiEmbed.setImage(imageUrl)
        }

        // Edit reply with embed
        if(gunsmithImg) {
            await interaction.editReply({ content: 'Result for: ' + search, embeds: [wikiEmbed], files: [file] })
        } else {
            await interaction.editReply({ content: 'Result for: ' + search, embeds: [wikiEmbed], files: [] })
        }

    })

    cluster.on('taskerror', (err, data, willRetry) => {
        if (willRetry) {
          console.warn(`Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`);
        } else {
          console.error(`Failed to crawl ${data}: ${err.message}`);
        }
    })

    await cluster.idle();
    await cluster.close();
}