export const dadosSimulado = {
    fase1: [
        // Question 1 - Test 1
        {
            idProva: "modelo_prova_alpha",
            tituloContexto: "In your opinion, what makes a briefing effective?",
            modeloResposta: `In my opinion, a briefing is effective when it is informative and concise.
            <ul style="margin: 15px 0; padding-left: 20px; text-align: left;">
                <li>It’s when the captain shares relevant information and the crew interacts.</li>
                <li>We need to talk about the weather, flight time and evacuation procedures.</li>
                <li>To wrap up, a briefing is effective when the crew members feel ready for the flight</li>
            </ul>`
        },
        // Question 2 - Test 1
        {
            idProva: "modelo_prova_alpha",
            tituloContexto: "What was the most difficult situation you have had in a flight?",
            modeloResposta: `The most difficult situation I had in a flight was in 2010.
            <ul style="margin: 15px 0; padding-left: 20px; text-align: left;">
                <li>It was a flight from <strong>Waterford</strong> to <strong>Chicago</strong></li>
                <li>and I was in a <strong>Premier 1A</strong></li>
                <li>During the flight, we had <strong>ice accretion and control problems.</strong></li>
                <li>So, we decided to <strong>contact ATC, hold and work the checklist to return.</strong></li>
                <li>After landing, we  <strong>did applied the de-icing fluid and took off again.</strong></li>
            </ul>`
      
        },
        // Question 3 - Test 1
        {
            idProva: "modelo_prova_alpha",
            tituloContexto: "Could you describe the airport you operate at the most?",
            modeloResposta: `The airport I operate the most is Waterford international in Michigan.
            <ul style="margin: 15px 0; padding-left: 20px; text-align: left;">
                <li>It is <strong>an international </strong> airport.</li>
                <li>It has a <strong>long and paved </strong>runway.</li>
                <li><strong>Waterford international </strong>is a <strong>towered airport</strong>and</li>
                <li>The controllers are <strong>very efficient and polite. </strong></li>
                <li>The are <strong>visual</strong> and <strong>low-visibility</strong> procedures.</li>
                <li>It also has a <strong>small terminal and standard security</strong></li>
            </ul>`
        },
        // Question 4 - Test 2
        {
            idProva: "modelo_prova_bravo",
            tituloContexto: "WHAT IS THE MOST DIFFICULT PHASE OF A FLIGHT?",
            modeloResposta: `In my opinion, the most difficult phase of the flight is the takeoff.
            <ul style="margin: 15px 0; padding-left: 20px; text-align: left;">
                <li>Because, during takeoff, the aircraft is:</li>
                <li>So, in case of a problem, we don't have time to find a solution.</li>
                <li>Also, the airplane doesn't have any extra power in its engines.</li>
                <li>So, in case a problem happens after V1, we don't have many options and we must keep climbing.</li>
            </ul>`
        },
        // Question 5 - Test 2
        {
            idProva: "modelo_prova_bravo",
            tituloContexto: "Who was your best flight instructor and why?",
            modeloResposta: `My best flight instructor was Peter, because he taught me many things, like:
            <ul style="margin: 15px 0; padding-left: 20px; text-align: left;">
                <li>Checking all the weather reports before a flight;</li>
                <li>reading and interpreting our flight charts.</li>
                <li>He also, showed me how to perform a good walkaround and identify possible hazards.</li>
                <li>Today, he is a captain at Delta Airlines and we still keep in touch</li>
            </ul>`
      
        },
        // Question 6 - Test 2
        {
            idProva: "modelo_prova_bravo",
            tituloContexto: "In your opinion, what can airlines do to improve the working conditions for pilots?",
            modeloResposta: `I believe companies can do many things to improve pilot's working conditions. For example:
            <ul style="margin: 15px 0; padding-left: 20px; text-align: left;">
                <li>Companies can provide a good flight schedule with adequate rest between flights to minimize fatigue.</li>
                <li>They can respect the maintenance routine of the aircraft to avoid unnecessary problems or issues during the flight.</li>
                <li>Companies can invest in training and support so pilots feel prepared for their operations.</li>
                <li>And finally, pay good salaries to motivate the crew.</li>
            </ul>`
        },
    ],
    fase2: [
        // Test 1
        {
            idProva: "modelo_prova_alpha",
            interacao: 1,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are going to land at Toronto Airport. Listen to Toronto Arrival Control and read back.",
                    audioUrl: "assets/audios/test1/1.1 - SDEA.mp3",
                    transcricao: "ANAC 123, Toronto Arrival Control. Expect visual approach, runway 05. Descend to 8000ft.",
                    model: "<em>Toronto Control, this is ANAC123. I will expect visual approach, runway 05 and Descend to 8000ft.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, the ATIS informs there is work in progress on several taxiways. Call Toronto Arrival to request to land on runway 15L, which is the closest to your company’s gates.",
                    model: "<em>Toronto Arrival, We request to land on runway 15L, because it's closer to my company's gate. ANAC123.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Now, listen to the ATC and confirm or clarify.",
                    audioUrl: "assets/audios/test1/1.2 - SDEA.mp3",
                    transcricao: "ANAC 123, stop your descent at 9.000ft and reduce to minimum clean speed. Are you requesting to land on runway 15L? Confirm.",
                    model: "<em>AFFIRM, request landing on runway 15L. We will stop the descent at 9.000ft and reduce to minimum clean speed, ANAC 123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller instructed me to stop my descent at 9.000ft and reduce to the minimum clean speed. In the end, asked if I requested to land on runway 15L."
                }
            ]
        },
        {
            idProva: "modelo_prova_alpha",
            interacao: 2,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You have just taken off from Manaus Airport. Listen to Manaus Tower and readback.",
                    audioUrl: "assets/audios/test1/2.1- SDEA.mp3",
                    transcricao: "ANAC 123, airborne at 26. Maintain runway heading until passing 3.000ft. Contact Manaus Departure on frequency 119.25.",
                    model: "<em>Roger Manaus Tower, we will maintain runway heading until passing 3.000 feet. Contact Manaus Departure on 119.25, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, you have an air conditioning failure, and the passengers are complaining. Contact Manaus Approach Control to report your problem and request to return.",
                    model: "<em>Manaus Approach, we have an air conditioning failure. Requesting to return to Manaus, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to ATC instructions.",
                    audioUrl: "assets/audios/test1/2.2- SDEA.mp3",
                    transcricao: "ANAC 123, descend (at your discretion) to FL080, turn right heading 060º. No reported traffic. Confirm you have an air cabin depressurization.",
                    model: "<em>NEGATIVE, we have an air conditioning failure AND NOT a depressurization. Descending to FL080 and turning right heading 060º, ANAC 123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller instructed me to descend at my discretion to FL080 and turn right heading 060º. Finally, he asked me to confirm if we had a cabin depressurization."
                }
            ]
        },
        {
            idProva: "modelo_prova_alpha",
            interacao: 3,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are going to land at Manchester Airport. Listen to Manchester Control and readback.",
                    audioUrl: "assets/audios/test1/3.1 - SDEA.mp3",
                    transcricao: "ANAC 123, Manchester Control, descend to FL210, turn right heading 160º, expect 10 minute hold at Whiskey Hotel India VOR.",
                    model: "<em>Roger Manchester Control, descending to FL210 and turning right heading 160º, expecting 10-minute hold at WHI VOR, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, you notice that your left engine oil temperature has increased beyond limits so you decide to reduce power. Contact Manchester Control to report your problem and say your intentions.",
                    model: "<em>PANPAN (3x) Manchester Control, ANAC 123, we have a left engine overheat. We are reducing power, I need priority landing and technical assistance on the ground.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to the controller's amendment.",
                    audioUrl: "assets/audios/test1/3.2 - SDEA.mp3",
                    transcricao: "ANAC 123, fly direct to Manchester VOR and expect direct approach to runway 05L. understand you lost your left engine. Confirm?",
                    model: "<em>NEGATIVE. We did not lose the engine, we reduced its power. We will fly direct to Manchester VOR and expect direct approach to runway 05L, ANAC 123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller instructed me to fly direct to Manchester VOR and expect a direct approach on runway 05L. The controller also stated he understood I lost my left engine and asked me to confirm."
                }
            ]
        },
        {
            idProva: "modelo_prova_alpha",
            interacao: 4,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are going to land at Santiago Airport. Listen to Santiago Approach and readback.",
                    audioUrl: "assets/audios/test1/4.1 - SDEA.mp3",
                    transcricao: "ANAC 123, radar contact, turn right heading 190º, descend to 4.000 ft, report passing 8.000ft, and expect VOR approach to runway 35R.",
                    model: "<em>Santiago Approach, roger, we will turn right heading 190º, and descend to 4.000 feet. We will also report passing 8.000ft, and expect VOR approach runway 35R, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, during approach, you see this ahead of you. Call Santiago Approach to report the situation and request deviation.",
                    imageUrl: "assets/audios/test1/4.1,5 - SDEA.png",
                    model: "<em>Santiago Approach, there is a hot air balloon ahead of us. Request deviation, ANAC 123.</em>",
                    interacaoPermitida: [4,5]
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to the controller's reply.",
                    audioUrl: "assets/audios/test1/4.2 - SDEA.mp3",
                    transcricao: "ANAC 123, turn 30º left. Confirm the hot air balloon is at your 3 o’clock position.",
                    model: "<em>NEGATIVE. The hot air balloon is ahead of us, at our 12 o'clock. We are turning 30º left, ANAC123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller instructed me to turn 30º left and asked me to confirm if the hot air balloon was at my 3 o'clock position."
                }
            ]
        },
        {
            idProva: "modelo_prova_alpha",
            interacao: 5,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are at Malpensa Airport in Italy. Listen to Malpensa Ground and readback.",
                    audioUrl: "assets/audios/test1/5.1 - SDEA.mp3",
                    transcricao: "ANAC 123, taxi to holding point runway 35L. Give way to Delta Airlines 747 coming from your left and taxi via taxiway Victor, right on Whiskey, left on Golf Whiskey. Contact Tower to cross the runway.",
                    model: "<em>Malpensa Ground, We will taxi to holding point runway 35L, give way to Delta Airlines 747 and taxi via V, right on W, left on GW, and contact tower to cross runway, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, imagine that, as you are turning to the holding point, this situation happens to you. Call Malpensa Tower, report your problem and say your intentions.",
                    imageUrl: "assets/audios/test1/TEST1-I5.jpeg",
                    model: "<em>Malpensa Tower, when turning to holding point, we had an excursion from the taxiway, we are stuck on soft ground. I need a tow truck on my position, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to the controller's authorization.",
                    audioUrl: "assets/audios/test1/5.2 - SDEA.mp3",
                    transcricao: "ANAC 123, I understand you left the taxiway and got stuck. Confirm the situation and if you’ll need to disembark the passengers before being towed back onto the taxiway.",
                    model: "<em>AFFIRM. We are stuck. We will need to disembark the passengers before being tugged/towed, ANAC 123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller understood I left the taxiway and got stuck. Then, asked me to confirm the situation and if I needed to disembark my passengers before being towed back to the taxiway."
                }
            ]
        },
        // Test2
        {
            idProva: "modelo_prova_bravo",
            interacao: 1,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are going to land at Houston Airport. Listen to Houston Center and readback.",
                    audioUrl: "assets/audios/TEST 2/1.2 - SDEA.mp3",
                    transcricao: "ANAC123, descend and maintain 17.000ft. Altimeter setting 2996, expect vectors for RNAV runway 08L approach.",
                    model: "<em>Roger, Houston Center. Descending to 17.000ft. Altimeter 2996,. We'll expect RNAV approach for runway 08L. ANAC123.</em>"
                },
                // PROBLEM
                {
                    tipo: "bloco-texto",
                    titulo: "Now, you receive abnormal indications from your right-hand engine and decide to request priority landing. Contact Houston Approach and say your intentions.",
                    model: "<em>MAYDAY(3x) Houston Approach, ANAC 123. We have a problem with our right-hand engine. Request priority landing.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Now, listen to the ATC and confirm or clarify.",
                    audioUrl: "assets/audios/TEST 2/1.1 - SDEA.mp3",
                    transcricao: "ANAC123, Houston Approach, roger. Descend to 8.000ft, expect vectors to final approach. Say again the problem. Are you declaring an emergency?",
                    model: "<em>AFFIRM, we are receiving abnormal engine indications. Descending to 8.000ft and we'll expect vectors to final approach, ANAC123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller instructed me to descend to 8.000ft and to expect vectors to final approach. Then, asked me to repeat my problem. In the end, asked if I declared an emergency."
                }
            ]
        },
        {
            idProva: "modelo_prova_bravo",
            interacao: 2,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are going to land at Santiago Airport. Listen to Santiago Approach and readback.",
                    audioUrl: "assets/audios/TEST 2/2.1 - SDEA.mp3",
                    transcricao: "ANAC123, hold at (LESTA) intersection, left hand pattern, maintain FL100, expect further clearance in 10 minutes due to traffic.",
                    model: "<em>Roger. We'll hold at the intersection, with a left hand pattern and maintain FL100. Expecting clearance in 10 minute due to traffic. ANAC123.</em>"
                },
                // PROBLEM
                {
                    tipo: "bloco-texto",
                    titulo: "Now, while holding, you face severe turbulence. Call Santiago Approach, inform that you cannot accomplish the holding pattern at the assigned altitude and request a different flight level.",
                    model: "<em>Santiago Approach, ANAC123, we are passing through a severe turbulence area, unable to maintain FL100. Request to hold at a different flight level.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to ATC instructions.",
                    audioUrl: "assets/audios/TEST 2/2.2 - SDEA.mp3",
                    transcricao: "ANAC 123, confirm that you are able to maintain FL100 in spite of moderate turbulence. You are number 4 for landing.",
                    model: "<em>NEGATIVE. We are facing severe turbulence and we can't maintain FL100. We need a different Level to hold. Roger, number 4 to land. ANAC123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller asked me to confirm if I could maintain FL100 in spite of moderate turbulence. Then, informed I was number 4 for landing."
                }
            ]
        },
        {
            idProva: "modelo_prova_bravo",
            interacao: 3,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are flying to Manchester Airport. Listen to Manchester Control and readback.",
                    audioUrl: "assets/audios/TEST 2/3.1 - SDEA.mp3",
                    transcricao: "ANAC 123, Manchester Control, descend to FL210, turn right heading 160º, expect 10 minute hold at Whiskey Hotel India VOR.",
                    model: "<em>Roger Manchester Control, descending to FL210 and turning right heading 160º, expecting 10-minute hold at WHI VOR, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, you notice that your left engine oil temperature has increased beyond limits so you decide to reduce power. Contact Manchester Control to report your problem and say your intentions.",
                    model: "<em>PANPAN (3x) Manchester Control, ANAC 123, we have a left engine overheat. We are reducing power, I need priority landing and technical assistance on the ground.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to the controller's amendment.",
                    audioUrl: "assets/audios/TEST 2/3.2 - SDEA.mp3",
                    transcricao: "ANAC123, fly direct to Whiskey Hotel India VOR and expect direct approach to runway 05R. I understand you shut one of your engines down due to high oil temperature. Confirm?",
                    model: "<em>AFFIRM. I had to shut my engine down. We'll fly direct to WHI VOR and expect direct approach to runway 05R, ANAC123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller told me to fly direct to WHI VOR and expect direct approach to runway 05R. Then, asked me to confirm if I had shut down my engine due to high temperature."
                }
            ]
        },
        {
            idProva: "modelo_prova_bravo",
            interacao: 4,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are at San Francisco Airport. Listen to San Francisco Ground and readback.",
                    audioUrl: "assets/audios/TEST 2/4.1 - SDEA.mp3",
                    transcricao: "ANAC123, approved taxi to the holding point runway 01R via taxiways Golf, Bravo and Alpha. Approaching holding point monitor Tower on frequency 118.85. Number 6 for departure.",
                    model: "<em>San Francisco Ground, we'll taxi to the holding point of runway 01R, via taxiways G, B, A. Monitor Tower on 118.85. We are number 6, ANAC123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, during taxi, you see this. Call San Francisco Ground to inform them about the situation.",
                    imageUrl: "assets/audios/TEST 2/TEST 2 - I4.png",
                    model: "<em>San Francisco Ground. I can see a drone flying near the taxiway.</em>",
                    interacaoPermitida: [4,5]
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to the controller's reply.",
                    audioUrl: "assets/audios/TEST 2/4.2 - SDEA.mp3",
                    transcricao: "ANAC 123, hold position. Please confirm: Is there debris near your aircraft?",
                    model: "<em>NEGATIVE. There is a drone flying near my aircraft. Holding position, ANAC123.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller instructed me to hold position and to confirm if there were debris near my aircraft."
                }
            ]
        },
        {
            idProva: "modelo_prova_bravo",
            interacao: 5,
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "You are at Galeao Airport. Listen to Galeao Ground and readback",
                    audioUrl: "assets/audios/TEST 2/5.1 - SDEA.mp3",
                    transcricao: "ANAC 123, good morning! Start up and pushback approved, temperature 28º, report ready for taxi and advise number of persons onboard.",
                    model: "<em>Galeao Ground, start up and push back approved. Will report ready for taxi. We have 100 persons onboard, ANAC 123.</em>"
                },
                {
                    tipo: "bloco-texto",
                    titulo: "Now, during pushback, this situation happens to you. Call Galeao Ground to inform them about the situation.",
                    imageUrl: "assets/audios/TEST 2/TEST2-I5.png",
                    model: "<em>Galeao Ground, ANAC123, we have collided with a pushback truck. We need assistance here.</em>"
                },
                {
                    tipo: "bloco-audio-pergunta",
                    titulo: "Listen to the controller's authorization.",
                    audioUrl: "assets/audios/TEST 2/5.2 - SDEA.mp3",
                    transcricao: "ANAC 123, hold position. We can see a pushback tow truck struck your right engine. Confirm. We are sending assistance.",
                    model: "<em>AFFIRM. We have collided with a pushback truck. Waiting for assistance.</em>",
                    perguntaFinal: "WHAT DID THE CONTROLLER SAY?",
                    respostaFinal: "The controller told me to hold position and informed he could see a tow truck hit my right engine. Then, informed he would send assistance."
                }
            ]
        },
    ],
    fase3: [
        {
            idProva: "modelo_prova_alpha",
            blocoLinear: true,
            conteudo: [
                {
                    tipo: "bloco-audio",
                    titulo: "Situation 1",
                    audioUrl: "assets/audios/TEST 2/6 - SDEA.mp3",
                    transcricao: "ATC: Jetblue 755, descend to FL240. I just want to verify: you said you need medical assistance. Is that correct? </br></br> Pilot: Washington Center, negative. We need assistance to navigate. Our navigation system is not working properly. Descending to FL250, Jetblue 755.",
                    model: "<em>The controller asked JetBlue to descend to flight level 240 and confirmed whether they needed medical assistance. </br></br> The pilot said negative and clarified that they actually needed navigation assistance because their navigation system wasn’t working properly, and they were descending to FL 250. </br></br>ATC repeated the instruction to descend to FL 240, and the pilot confirmed.</em>",
                    perguntaFinal: "Why is reading back so important?", 
                    respostaFinal: "<em>Reading back is important because it ensures clear and correct communication between pilots and controllers. When we repeat the instruction, ATC can confirm that the message was heard and understood. This helps prevent serious errors such as flying the wrong heading, altitude, or frequency.</em>"
                },
                {
                    tipo: "bloco-audio",
                    titulo: "Situation 2 ",
                    audioUrl: "assets/audios/TEST 2/7 - SDEA.mp3",
                    transcricao: "Pilot: Lyon Center, this is tiger 456, IFR from Paris to Frankfurt, at FL080, taking heading 280º to avoid weather. </br></br> ATC: Tiger 456, roger. Maintain present altitude, turn left heading 270º for separation. Contact Clermont Approach on frequency 128.65.",
                    model: "<em>The pilot reported to Lyon Center that they were on an IFR flight from Paris to Frankfurt, flying at FL080 and turning to heading 280º to avoid weather. </br></br>ATC acknowledged and instructed the pilot to maintain the present altitude, turn left heading 270º for separation, and contact Clermont Approach on frequency 128.65.</em>",
                    perguntaFinal: "What can happen to an aircraft if it flies into a cumulonimbus cloud?", 
                    respostaFinal: "<em>Runway incursions can be avoided with: </br></br>proper communication and standard phraseology; updated charts; high situational awareness; clear markings; and a good flight planning.</em>"
                },
                {
                    tipo: "bloco-audio",
                    titulo: "Situation 3 ",
                    audioUrl: "assets/audios/TEST 2/8 - SDEA.mp3",
                    transcricao: "Pilot: Miami Approach, Delta 61 heavy. We lost our hydraulic system. Request the longest available runway to perform a flaps up landing. </br></br>ATC: Delta 61 heavy. Expect approach to runway 09L. State top of descent. Do you need any assistance upon landing?",
                    model: "<em>The pilot reported to Miami Approach that they had lost the hydraulic system and requested the longest available runway to perform a flaps-up landing.</br></br> ATC understood the problem and told them to expect an approach to runway 09L, asked them to report the top of descent, and asked if they would  need assistance upon landing.</em>",
                    perguntaFinal: "What may happen when a hydraulic system fails?", 
                    respostaFinal: "<em>A hydraulic system failure can lead to:</br></br> Loss of controls; Flap Problems; A jammed landing gear; Brake failure; landing or a runway overrun.</em>"
                },
            ],
            comparacaoCustomizada: {
                perguntaHTML: `Now, after listening to the 3 situations. Compare them in terms of severity, possible solutions or ways of prevention<br><span style="font-size: 13px; font-weight: normal; color: #666;"></span>`,
                guiaAjudaHTML: `
                    <p style="margin-bottom: 20px; font-size: 15px;">👉 <strong>In my opinion, the most dangerous situation is</strong> ____________, <strong>because</strong> __________________ ;</p>
                    <p style="margin-bottom: 20px; font-size: 15px;">👉 <strong>After that, the</strong> ____________ <strong>is not so dangerous, because there are checklists and procedures to solve it ;</strong></p>
                    <p style="margin-bottom: 5px; font-size: 15px;">👉 <strong>And finally, the easiest situation to deal with is</strong> ____________, <strong>because</strong> __________________ .</p>
                `,
                // \/ pode remover
                modeloRespostaHTML: `
                    <p style="margin-bottom: 10px;"><strong>Model Guide for Alpha evaluation:</strong></p>
                    <p style="line-height: 1.6; font-style: italic; color: #444;">
                        "In my opinion, the most dangerous situation is the <strong>Heavy Smoke in the Cabin</strong>, because fire or smoke on board requires immediate emergency descent before losing control.<br><br>
                        After that, the <strong>Bird Strike with Engine Vibration</strong>, because high vibrations can lead to structural damage if not managed quickly.<br><br>
                        And finally, the easiest situation to deal with is the <strong>Total Loss of Hydraulic Pressure</strong>, because although flight controls are sluggish, we require a long final to manage stability smoothly."
                    </p>
                `
                
            }
        },
    ],
    fase4: [
        // Test 1
        {
            idProva: "modelo_prova_alpha",
            blocoImagemCompleto: true,
            imageUrl: "assets/audios/test1/12C -LOTBELLYLANDING.jpeg", 
            descricaoHtml: `
                <p style="margin-bottom: 15px; font-size: 15px;"><strong>In this picture I can see a wide body airliner that is performing a belly landing</strong>
                </br></br>In the center part, I can see a low-wing, wide body commercial jet. This is a Boeing 767 operated by LOT, it’s in a passenger configuration. The pilot is performing a belly landing, since the landing gears are retracted. The flaps are extended and I can see a lot of smoke coming from the airplane, caused by the friction after touchdown. In the background, I can notice some trees and the sky was overcast but the visibility is good. This picture was taken at dawn or early morning.</p>
            `,
            perguntas: [
                { perguntaTexto: "What happened before this picture was taken?", respostaTexto: "Before this picture was taken, the aircraft had experienced a landing gear malfunction. The pilots were unable to extend the landing gear, so they declared an emergency and prepared for a belly landing. They worked the checklists, burned or dumped fuel to reduce landing weight, and coordinated with air traffic control for an emergency landing clearance." },
                { perguntaTexto: "Now imagine this picture has just been taken: What do you think will happen next?", respostaTexto: "I believe the aircraft will continue sliding along the runway until it comes to a complete stop. Once the airplane stops, the crew will shut down the engines, deploy the slides, and start the evacuation. Emergency vehicles and firefighters will approach and assist during the procedure.Finally, the runway will be closed for inspection and cleanup." },
                { perguntaTexto: "How do pilots get prepared for an emergency landing?", respostaTexto: "To prepare for a belly landing, we need to:</br>First, identify the problem and try to use our backup extension;</br>After that, Inform ATC and request a position to hold and work the checklist;</br>Then, request runway preparation and emergency services on standby;</br>Finally, approach slowly and prepare for touchdown." },
                { perguntaTexto: "Why are there flames coming out from under the airplane?", respostaTexto: "There are flames coming out from under the airplane because of the friction between the fuselage and the runway. The aircraft’s metal belly is sliding on the surface and this creates  sparks, smoke and fire." },
            ],
            statement: {
                textoAfirmacao: '"Dumping fuel and asking the fire fighters to lay out foam on the runway before landing would reduce the risk of fire during a belly landing."',
                agreeTexto: "I agree because dumping reduces the amount of fuel on board, which lowers the risk of fire or explosion after touchdown. </br></br>In addition, runway preparation can help reduce the friction and minimize sparks providing a smoother and safer landing.",
                disagreeTexto: "I disagree because modern airport fire services are already well-prepared to respond immediately after landing, and laying foam beforehand isn’t always effective because it can cause a runway overrun. </br></br>Also, in some emergencies, there may not be enough time or conditions to dump fuel safely, so pilots must focus on landing promptly and following standard procedures."
            }
        },
        {
            idProva: "modelo_prova_alpha",
            blocoImagemCompleto: true,
            imageUrl: "assets/audios/test1/12C - CONTACT AIR .jpeg", 
            descricaoHtml: `
                <p style="margin-bottom: 15px; font-size: 15px;">In this picture I can see a regional jet that had a gear collapse after landing
                </br></br>In the front part of the picture, there’s a large grass area with some runway signs and markings.
                </br></br>In the center, I can see a <b>passenger aircraft</b>, It is a low-wing, tri jet airplane with a t-tail. It is operated by Contact air and there are <b>flames and smoke</b> coming from its belly. 
                </br></br>It seems to be have suffered a main gear collapse, since the nose gear is extended. The flaps are down, and the pilot is controlling the aircraft.
                </br></br>In the background, there are <b>airport buildings, a vehicle, perimeter fences, trees, and a hill.</b> The weather looks cloudy but visibility is good.</p>
            `,
            perguntas: [
                { perguntaTexto: "What happened before this picture was taken?", respostaTexto: "Before this picture was taken, the pilot had declared an emergency due to a landing gear failure. The pilots attempted to extend the gear, but it didn’t deploy. Then, they followed the emergency checklist, informed air traffic control, and prepared to land. Finally, they started the approach and landed, controlling the airplane." },
                { perguntaTexto: "Now imagine this picture has just been taken: What do you think will happen next?", respostaTexto: "The aircraft will continue sliding along the runway until it stops. The pilots will keep the nose up to reduce friction. Once the airplane stops, the crew will order an evacuation using the emergency slides. Firefighters, will extinguish the flames and cool down the fuselage. After all passengers and crew are safe, the airport authorities will close the runway for inspection and remove the aircraft." },
                { perguntaTexto: "How do pilots get prepared for an emergency landing?", respostaTexto: "To prepare for a belly landing, we need to:</br>First, identify the problem and try to use our backup extension;</br>After that, Inform ATC and request a position to hold and work the checklist;</br>Then, request runway preparation and emergency services on standby;</br>Finally, approach slowly and prepare for touchdown." },
                { perguntaTexto: "Why are there flames coming out from under the airplane?", respostaTexto: "There are flames coming out from under the airplane because of the friction between the fuselage and the runway. The aircraft’s metal belly is sliding on the surface and this creates  sparks, smoke and fire." },
            ],
            statement: {
                textoAfirmacao: '"Dumping fuel and asking the fire fighters to lay out foam on the runway before landing would reduce the risk of fire during a belly landing."',
                agreeTexto: "I agree because dumping reduces the amount of fuel on board, which lowers the risk of fire or explosion after touchdown. </br></br>In addition, runway preparation can help reduce the friction and minimize sparks providing a smoother and safer landing.",
                disagreeTexto: "I disagree because modern airport fire services are already well-prepared to respond immediately after landing, and laying foam beforehand isn’t always effective because it can cause a runway overrun. </br></br>Also, in some emergencies, there may not be enough time or conditions to dump fuel safely, so pilots must focus on landing promptly and following standard procedures."
            }
        },
        {
            idProva: "modelo_prova_alpha",
            blocoImagemCompleto: true,
            imageUrl: "assets/audios/test1/12C - FIGHTER JET.jpeg", 
            descricaoHtml: `
                <p style="margin-bottom: 15px; font-size: 15px;">In this picture I can see a military jet performing a belly landing.
                </br></br>In the foreground, there is some gravel, probably at the edge of a runway.
                </br></br>In the center, I can see a U.S. Navy Blue Angels jet, painted in dark blue with yellow markings.
                </br></br>The aircraft’s landing gear is retracted, and it’s sliding directly on its fuselage, producing flames and sparks due to the friction with the ground. The pilot canopy appears intact, and the jet is slightly pitched up, which helps reduce the damage.
                </br></br>In the background, I can notice some trees and light fog.</p>
            `,
            perguntas: [
                { perguntaTexto: "What happened before this picture was taken?", respostaTexto: "Before this picture was taken, the pilot probably had a hydraulic failure, preventing the landing gear from extending. </br> </br>The pilot also declared an emergency, coordinated with air traffic control, and prepared for a belly landing. Then, he followed the emergency procedures and performed a safe landing." },
                { perguntaTexto: "Now imagine this picture has just been taken: What do you think will happen next?", respostaTexto: "After this picture was taken, the pilot will continue to control the aircraft to slow down and avoid a violent impact with the ground. </br></br> Once the jet stops, the pilot will shut down the engines and quickly evacuate by opening the canopy. Fire trucks will extinguish the flames and make sure the area is safe." },
                { perguntaTexto: "How do pilots get prepared for an emergency landing?", respostaTexto: "To prepare for a belly landing, we need to:</br>First, identify the problem and try to use our backup extension;</br>After that, Inform ATC and request a position to hold and work the checklist;</br>Then, request runway preparation and emergency services on standby;</br>Finally, approach slowly and prepare for touchdown." },
                { perguntaTexto: "Why are there flames coming out from under the airplane?", respostaTexto: "There are flames coming out from under the airplane because of the friction between the fuselage and the runway. The aircraft’s metal belly is sliding on the surface and this creates  sparks, smoke and fire." },
            ],
            statement: {
                textoAfirmacao: '"Dumping fuel and asking the fire fighters to lay out foam on the runway before landing would reduce the risk of fire during a belly landing."',
                agreeTexto: "I agree because dumping reduces the amount of fuel on board, which lowers the risk of fire or explosion after touchdown. </br></br>In addition, runway preparation can help reduce the friction and minimize sparks providing a smoother and safer landing.",
                disagreeTexto: "I disagree because modern airport fire services are already well-prepared to respond immediately after landing, and laying foam beforehand isn’t always effective because it can cause a runway overrun. </br></br>Also, in some emergencies, there may not be enough time or conditions to dump fuel safely, so pilots must focus on landing promptly and following standard procedures."
            }
        },
        // Test 2
        {
            idProva: "modelo_prova_bravo",
            blocoImagemCompleto: true,
            imageUrl: "assets/audios/TEST 2/Incursion - Skyteam.png", 
            descricaoHtml: `
                <p style="margin-bottom: 15px; font-size: 15px;"><strong>In this picture I can see a runway incursion involving two large commercial aircraft.</p>
                <p style="margin-bottom: 15px; font-size: 15px;"><strong>In the foreground, there is a widebody Airbus A340 in SkyTeam livery crossing the runway.</p>
                <p style="margin-bottom: 15px; font-size: 15px;">The aircraft is still on the runway surface. I can also see the runway edge lights. In the background, I can see another jet on short final, it is in a landing configuration, since the landing gear and flaps are extended and landing lights are on, This twin-engine is on short final.</p>
                <p style="margin-bottom: 15px; font-size: 15px;">Possibly initiating a go around procedure.</p>
                <p style="margin-bottom: 15px; font-size: 15px;">The visibility seems good, and this was taken during dusk or dawn.</p>
                <p style="margin-bottom: 15px; font-size: 15px;">Overall, this image shows a high-risk runway incursion, where one aircraft is occupying the runway while another is about to land, creating a very dangerous situation.</p>
            `,
            perguntas: [
                { perguntaTexto: "What happened before this picture was taken?", respostaTexto: "Before this picture was taken, there was some miscommunication and the Skyteam aircraft was cleared to taxi or cross the runway. </br></br>At the same time, the twin-engine aircraft was cleared to land on the same runway. But on short final, the pilot saw identified the runway incursion and started a go around procedure." },
                { perguntaTexto: "Now imagine this picture has just been taken: What do you think will happen next?", respostaTexto: "The approaching aircraft will most likely execute a go-around to avoid a collision. </br></br>Air traffic control will cancel the landing clearance and instruct the aircraft to climb and rejoin the pattern.</br></br> At the same time, the aircraft on the runway will be instructed to vacate the runway as quickly as possible." },
                { perguntaTexto: "What are the possible reasons that could lead to a runway incursion?", respostaTexto: "Possible reasons for a runway incursion include: </br><ul style=margin:10%;>Miscommunication with ATC, such as misunderstandings or incorrect clearances <li>Pilot error, including loss of situational awareness or incorrect taxi routing</li><li>Vehicle or pedestrian error, when airport staff enter a runway without authorization</li><li>Poor visibility, due to fog, rain, or night operations</li><li>Complex airport layout, confusing or similar taxiway/runway markings</li><li>High workload, distractions, or time pressure in the cockpit or tower</li></ul></br>In most cases, runway incursions result from a combination of human factors and operational complexity." },
                { perguntaTexto: "In your opinion, how can runway incursions be prevented?", respostaTexto: "Runway incursions can be prevented mainly through good communication, awareness, and procedures.</br></br>Pilots must read back clearances correctly, use airport charts, and stop if unsure about their position or clearance. </br></br>Air traffic controllers need to use standard phraseology and monitor aircraft and vehicles closely, especially in low visibility.</br></br>Airports also help by improving, markings, lighting, and using runway status lights and surface radar. </br>Finally, proper training and discipline for pilots, controllers, and ground personnel are essential to reduce the risk." },
            ],
            statement: {
                textoAfirmacao: '"Confusing layouts of runways and taxiways are likely to increase the number of accidents and incidents involving runway incursions."',
                agreeTexto: "I agree with this statement, because complex or confusing runway and taxiway layouts can easily lead to loss of situational awareness, especially at large or unfamiliar airports. </br></br> When taxiways intersect runways pilots may get confused with their position, increasing the risk of entering an active runway by mistake, particularly in poor visibility or at night. ",
                disagreeTexto: "I disagree with this statement, because good procedures and technology can reduce this risk. With proper planning, updated charts and clear ATC instructions, pilots and ground vehicles can operate even at complex airports. So, layout alone is not the only factor, human factors and communication play a major role."
            }
        },
        {
            idProva: "modelo_prova_bravo",
            blocoImagemCompleto: true,
            imageUrl: "assets/audios/TEST 2/Incursion - Airport.png", 
            descricaoHtml: `
                <p style="margin-bottom: 15px; font-size: 15px;">Once separation is re-established, operations will resume, and the incident will be reported and investigated as a runway incursion
                </br></br>In this picture I can see an airport with an aircraft on final approach while the other one is starting the takeoff roll.
                </br></br>In the center of the picture, I can see the airport control tower. On the left side, there is a small aircraft on short final, with the landing gear extended, indicating it is about to land.
                </br></br>In the background, I can see the runway and a grass area around it, with good visibility and daylight conditions.
                </br></br>There is a jet on the runway, possibly starting its takeoff roll. Which indicates a runway incursion. The weather seems calm and clear, which suggests this was caused by miscommunication.
                </br></br>Overall, the picture shows a critical problem, where accurate communication between pilots and air traffic control is essential to avoid conflicts or runway incursions.</p>
            `,
            perguntas: [
                { perguntaTexto: "What happened before this picture was taken?", respostaTexto: "Before this picture was taken, the approaching aircraft was vectored and cleared for an approach by air traffic control.</br></br>The pilot was established on final, configured the aircraft for landing, and carried out the landing checklist. </br></br>At the same time, the control tower cleared an airplane to line up, resulting in a runway incursion. </br></br>The aircraft on final had to start a missed approach." },
                { perguntaTexto: "Now imagine this picture has just been taken: What do you think will happen next?", respostaTexto: "I think that, the aircraft will initiate a go around, report the reason and ask the controller for vectors in order to perform a new approach. The other aircraft will be cleared for takeoff, and authorities will launch an investigation to see what caused this incursion." },
                { perguntaTexto: "What are the possible reasons that could lead to a runway incursion?", respostaTexto: "Possible reasons for a runway incursion include: </br><ul style=margin:10%;>Miscommunication with ATC, such as misunderstandings or incorrect clearances <li>Pilot error, including loss of situational awareness or incorrect taxi routing</li><li>Vehicle or pedestrian error, when airport staff enter a runway without authorization</li><li>Poor visibility, due to fog, rain, or night operations</li><li>Complex airport layout, confusing or similar taxiway/runway markings</li><li>High workload, distractions, or time pressure in the cockpit or tower</li></ul></br>In most cases, runway incursions result from a combination of human factors and operational complexity." },
                { perguntaTexto: "In your opinion, how can runway incursions be prevented?", respostaTexto: "Runway incursions can be prevented mainly through good communication, awareness, and procedures.</br></br>Pilots must read back clearances correctly, use airport charts, and stop if unsure about their position or clearance. </br></br>Air traffic controllers need to use standard phraseology and monitor aircraft and vehicles closely, especially in low visibility.</br></br>Airports also help by improving, markings, lighting, and using runway status lights and surface radar. </br>Finally, proper training and discipline for pilots, controllers, and ground personnel are essential to reduce the risk." },
            ],
            statement: {
                textoAfirmacao: '"Confusing layouts of runways and taxiways are likely to increase the number of accidents and incidents involving runway incursions."',
                agreeTexto: "I agree with this statement, because complex or confusing runway and taxiway layouts can easily lead to loss of situational awareness, especially at large or unfamiliar airports. </br></br> When taxiways intersect runways pilots may get confused with their position, increasing the risk of entering an active runway by mistake, particularly in poor visibility or at night. ",
                disagreeTexto: "I disagree with this statement, because good procedures and technology can reduce this risk. With proper planning, updated charts and clear ATC instructions, pilots and ground vehicles can operate even at complex airports. So, layout alone is not the only factor, human factors and communication play a major role."
            }
        },
        {
            idProva: "modelo_prova_bravo",
            blocoImagemCompleto: true,
            imageUrl: "assets/audios/TEST 2/Incursion - Vehicle.png", 
            descricaoHtml: `
                <p style="margin-bottom: 15px; font-size: 15px;">This picture shows a runway incursion situation.
                </br></br>In the foreground, we can see an active runway, and there is a ground vehicle positioned very close to the runway centerline. In the background, a commercial aircraft is on short final, with the landing gear down and landing lights on, configured to land.
                </br></br>Weather conditions appear to be poor, with reduced visibility, possibly due to mist or low clouds, which can increase the risk of this type of incident.
                </br></br>Overall, the image illustrates a safety hazard, because the runway is not clear while an aircraft is about to land. This situation would normally require immediate ATC intervention, most likely resulting in a go-around to avoid a collision.</p>
            `,
            perguntas: [
                { perguntaTexto: "What happened before this picture was taken?", respostaTexto: "Before this picture was taken, the aircraft was cleared for approach and was flying the final segment, descending toward the runway.</br></br>At the same time, a ground vehicle was authorized to operate on the runway or nearby, possibly for inspection, maintenance, or emergency purposes. </br></br>Due to loss of situational awareness, the vehicle remained on the runway while the aircraft continued its approach.</br></br>As a result, a runway incursion developed, with the aircraft now on short final and the runway not clear." },
                { perguntaTexto: "Now imagine this picture has just been taken: What do you think will happen next?", respostaTexto: "Next, the pilot will initiate a go-around after spotting the vehicle on the runway or receiving an ATC warning.</br></br>At the same time, ATC will instruct the vehicle to vacate the runway and ensure the runway is clear. </br></br>Once separation is re-established and the situation is under control, the aircraft may be vectored for another approach or instructed to hold." },
                { perguntaTexto: "What are the possible reasons that could lead to a runway incursion?", respostaTexto: "Possible reasons for a runway incursion include: </br><ul style=margin:10%;>Miscommunication with ATC, such as misunderstandings or incorrect clearances <li>Pilot error, including loss of situational awareness or incorrect taxi routing</li><li>Vehicle or pedestrian error, when airport staff enter a runway without authorization</li><li>Poor visibility, due to fog, rain, or night operations</li><li>Complex airport layout, confusing or similar taxiway/runway markings</li><li>High workload, distractions, or time pressure in the cockpit or tower</li></ul></br>In most cases, runway incursions result from a combination of human factors and operational complexity." },
                { perguntaTexto: "In your opinion, how can runway incursions be prevented?", respostaTexto: "Runway incursions can be prevented mainly through good communication, awareness, and procedures.</br></br>Pilots must read back clearances correctly, use airport charts, and stop if unsure about their position or clearance. </br></br>Air traffic controllers need to use standard phraseology and monitor aircraft and vehicles closely, especially in low visibility.</br></br>Airports also help by improving, markings, lighting, and using runway status lights and surface radar. </br>Finally, proper training and discipline for pilots, controllers, and ground personnel are essential to reduce the risk." },
            ],
            statement: {
                textoAfirmacao: '"Confusing layouts of runways and taxiways are likely to increase the number of accidents and incidents involving runway incursions."',
                agreeTexto: "I agree with this statement, because complex or confusing runway and taxiway layouts can easily lead to loss of situational awareness, especially at large or unfamiliar airports. </br></br> When taxiways intersect runways pilots may get confused with their position, increasing the risk of entering an active runway by mistake, particularly in poor visibility or at night. ",
                disagreeTexto: "I disagree with this statement, because good procedures and technology can reduce this risk. With proper planning, updated charts and clear ATC instructions, pilots and ground vehicles can operate even at complex airports. So, layout alone is not the only factor, human factors and communication play a major role."
            }
        },

    ]
};