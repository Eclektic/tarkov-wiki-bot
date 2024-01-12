import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import puppeteer from 'puppeteer';

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

	await interaction.reply('Searching for: ' + search)

	// Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: 'new', userDataDir: './../userDataDir' })
    const page = await browser.newPage()

    await page.setRequestInterception(true);

	page.on('request', (request) => {
		if (['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
			request.abort()
		} else {
			request.continue()
		}
	});

    // Set screen size
    //await page.setViewport({width: 1920, height: 1080})

    // Navigate the page to a URL
    await page.goto('https://escapefromtarkov.fandom.com/fr/wiki/Sp%C3%A9cial:Recherche?fulltext=1&query=' + search)

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
        // Close headless session
	    await browser.close()
        // Edit reply with embed
	    await interaction.editReply('Sorry bro, no result found for: ' + search)
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
	const url = page.url()

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
        elGuideText.forEach(async (el, i = 0) => {
            guideText += '\n' +  await page.evaluate(el => el.textContent, elGuideText[i])
        });
    }
    
    // Get type
    const elType = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"][text()="Type"]/following-sibling::td[@class="va-infobox-content"]')
    const typeTxt = await page.evaluate(el => el.innerText, elType[0])

    // Get zone
    const elZone = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"][text()="Zone"]/following-sibling::td[@class="va-infobox-content"]/a')
    let zoneTxt
    if(elZone.length >= 1) {
        zoneTxt = await page.evaluate(el => el.textContent, elZone[0])
    }

    // Get given by
    const elGivenBy = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"][text()="Donnée par"]/following-sibling::td[@class="va-infobox-content"]/a')
    const givenByTxt = await page.evaluate(el => el.textContent, elGivenBy[0])

    // Get Kappa
    const elKappa = await page.$x('//tr[@id="va-infobox0-content"]//td[@class="va-infobox-label"]/a[text()="Kappa"]/../following-sibling::td[@class="va-infobox-content"]/font')
    const kappaTxt = await page.evaluate(el => el.textContent, elKappa[0])

    // Get prev quest

    // Get next quest

    // Get images
    const elImage = await page.$x('//ul[@class="gallery mw-gallery-packed"]//a[@class="image"][1]')
    let imageUrl
    if(elImage.length >= 1) {
        imageUrl = await page.evaluate(el => el.getAttribute('href'), elImage[0])
    }

    // Close headless session
	await browser.close();

    // Create embed
	let wikiEmbed = new EmbedBuilder()
		.setTitle(mainTitle)
		.setURL(url)
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
	await interaction.editReply({ embeds: [wikiEmbed] })
}