// =========================================================
// FIREBASE INITIALISERING
// =========================================================
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig); // Henter konfiguration fra config.js
}

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
const CMS_DOC = db.collection("siteData").doc("cmsState");

const CMS_KEYS = [
    "arfianka_email_config","arfianka_logo","arfianka_profile","arfianka_background",
    "arfianka_about_name","arfianka_about_role","arfianka_about_p1","arfianka_about_p2",
    "arfianka_about_deleted", "arfianka_about_section_title", "arfianka_about_show_image",
    "arfianka_services","arfianka_library","arfianka_layout_plus",
    "arfianka_linked_services","arfianka_contact_plus","arfianka_employees_plus",
    "arfianka_modules_plus"
];

let cmsReadyResolve;
const firebaseCmsReady = new Promise(resolve => cmsReadyResolve = resolve);
let applyingRemoteCms = false;

function cmsField(key){ return key.replace(/[^A-Za-z0-9_]/g,"_"); }

async function cmsSetItem(key,value){
    localStorage.setItem(key,String(value));
    if(!CMS_KEYS.includes(key) || applyingRemoteCms) return;
    const update={}; update[cmsField(key)]=String(value);
    update.updatedAt=firebase.firestore.FieldValue.serverTimestamp();
    update.updatedBy=auth.currentUser ? (auth.currentUser.email || auth.currentUser.uid) : "public";
    await CMS_DOC.set(update,{merge:true});
}

async function cmsRemoveItem(key){
    localStorage.removeItem(key);
    if(!CMS_KEYS.includes(key) || applyingRemoteCms) return;
    const update={}; update[cmsField(key)]=firebase.firestore.FieldValue.delete();
    await CMS_DOC.set(update,{merge:true});
}

async function loadCmsFromFirebase(){
    try{
        const snap=await CMS_DOC.get();
        applyingRemoteCms=true;
        if(snap.exists){
            const data=snap.data()||{};
            CMS_KEYS.forEach(key=>{
                const field=cmsField(key);
                if(Object.prototype.hasOwnProperty.call(data,field)) localStorage.setItem(key,data[field]);
            });
        }
        console.info("Firebase CMS connected", snap.exists ? "data loaded" : "empty state");
    }catch(error){
        console.error("Firebase CMS load failed",error);
        setTimeout(()=>alert("Firestore read failed ["+(error.code||"unknown")+"]: "+(error.message||error)+"\nProject: "+firebaseConfig.projectId+"\nPath: siteData/cmsState"),0);
    }finally{
        applyingRemoteCms=false;
        cmsReadyResolve();
    }
}

let initialAuthStateHandled = false;
auth.onAuthStateChanged(async function(user) {
    if (initialAuthStateHandled) return;
    initialAuthStateHandled = true;
    console.info("Firebase auth state restored:", user ? user.email : "public visitor");
    await loadCmsFromFirebase();
}, function(error) {
    console.error("Firebase auth initialization failed", error);
    cmsReadyResolve();
});

setTimeout(function(){
    if(!initialAuthStateHandled){
        initialAuthStateHandled=true;
        console.warn("Firebase Auth initialization timed out; loading public CMS data.");
        loadCmsFromFirebase();
    }
},8000);

async function uploadFileToFirebase(file,folder){
    if(!auth.currentUser) throw new Error("Admin login required before uploading files");
    const safe=(file.name||"file").replace(/[^A-Za-z0-9._-]/g,"_");
    const ref=storage.ref().child("site/"+folder+"/"+Date.now()+"_"+safe);
    const snap=await ref.put(file,{contentType:file.type||"application/octet-stream"});
    return await snap.ref.getDownloadURL();
}

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(error) {
    console.error("Firebase Auth persistence error:", error);
});

db.enableNetwork().catch(function(error) {
    console.error("Firestore network error:", error);
});

const DEFAULT_EMAIL_CONFIG={serviceId:"service_m0ve9d9",notificationTemplateId:"template_q8r1xwl",autoReplyTemplateId:"template_wu2qsed",toEmail:"kucna.nega.arfianka@gmail.com",publicKey:"FIF_fc4HV9FDLofhS",sendAutoReply:true};
function getEmailConfig(){try{return {...DEFAULT_EMAIL_CONFIG,...JSON.parse(localStorage.getItem("arfianka_email_config")||"{}")}}catch(e){return {...DEFAULT_EMAIL_CONFIG}}}
function initEmailJS(){const c=getEmailConfig();if(window.emailjs&&c.publicKey)emailjs.init({publicKey:c.publicKey})}
initEmailJS();

// =========================================================
// SPROG SYSTEM
// =========================================================
function changeLanguage(lang) {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[lang] && translations[lang][key]) { // Henter fra lang.js
            el.innerText = translations[lang][key];
        }
    });
    
    const defaultOption = document.getElementById('service')?.options[0];
    if(defaultOption) {
        defaultOption.text = translations[lang]["form_opt_1"];
    }
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.innerText = translations[lang]["form_btn"];
    }
    applyLocalEdits(); 
}

// =========================================================
// LOCAL CONTENT MANAGEMENT (CMS)
// =========================================================
let currentServices = ["Onlajn sastanak", "Praktična pomoć", "Lična nega"];

document.addEventListener("DOMContentLoaded", async function() {
    await firebaseCmsReady;
    applyLocalEdits();
    const langSelector = document.getElementById('languageSelector');
    if (langSelector) {
        changeLanguage(langSelector.value);
    }
});

function applyLocalEdits() {
    const savedLogo = localStorage.getItem("arfianka_logo");
    if(savedLogo) {
        const siteLogo = document.getElementById('site-logo');
        const footerLogo = document.getElementById('footer-logo');
        if(siteLogo) siteLogo.src = savedLogo;
        if(footerLogo) footerLogo.src = savedLogo;
    }
    
    const savedProfile = localStorage.getItem("arfianka_profile");
    if(savedProfile) {
        const sitePic = document.getElementById('site-profile-pic');
        if (sitePic) sitePic.style.backgroundImage = `url(${savedProfile})`;
    }

    const savedBackground = localStorage.getItem("arfianka_background");
    const heroEl = document.getElementById('forside');
    if(heroEl) {
        if(savedBackground) {
            heroEl.style.background = `linear-gradient(rgba(13, 44, 84, 0.75), rgba(13, 44, 84, 0.75)), url(${savedBackground}) center/cover`;
        } else {
            heroEl.style.background = `radial-gradient(circle at center, rgba(195, 154, 92, 0.2) 0%, rgba(13, 44, 84, 0.85) 60%, #0d2c54 100%)`;
        }
    }
    
    const aboutName = localStorage.getItem("arfianka_about_name");
    const aboutRole = localStorage.getItem("arfianka_about_role");
    const aboutP1 = localStorage.getItem("arfianka_about_p1");
    const aboutP2 = localStorage.getItem("arfianka_about_p2");
    const isDeleted = localStorage.getItem("arfianka_about_deleted");
    const aboutSecTitle = localStorage.getItem("arfianka_about_section_title");
    const showImage = localStorage.getItem("arfianka_about_show_image");
    
    if (aboutSecTitle !== null) {
        const el = document.getElementById('about-section-title');
        if(el) {
            el.innerText = aboutSecTitle;
            el.removeAttribute('data-i18n');
        }
        const inputEl = document.getElementById('editAboutSectionTitle');
        if(inputEl) inputEl.value = aboutSecTitle;
    }
    
    const container = document.querySelector('.about-container');
    const pic = document.getElementById('site-profile-pic');
    const chk = document.getElementById('editAboutShowImage');

    if (showImage === "false") {
        if(pic) pic.style.display = "none";
        if(container) container.classList.add('no-image');
        if(chk) chk.checked = false;
    } else {
        if(pic) pic.style.display = ""; 
        if(container) container.classList.remove('no-image');
        if(chk) chk.checked = true;
    }
    
    const omOs = document.getElementById('om-os');
    if (omOs) {
        if (isDeleted === "true") {
            omOs.style.display = "none";
        } else {
            omOs.style.display = "block";
            if(aboutName) {
                document.getElementById('about-name').innerText = aboutName;
                if(document.getElementById('editAboutName')) document.getElementById('editAboutName').value = aboutName;
            }
            if(aboutRole) {
                document.getElementById('about-role').innerText = aboutRole;
                if(document.getElementById('editAboutRole')) document.getElementById('editAboutRole').value = aboutRole;
            }
            if(aboutP1) {
                document.getElementById('about-p1').innerText = aboutP1;
                if(document.getElementById('editAboutP1')) document.getElementById('editAboutP1').value = aboutP1;
            }
            if(aboutP2) {
                document.getElementById('about-p2').innerText = `"${aboutP2.replace(/"/g, '')}"`; 
                if(document.getElementById('editAboutP2')) document.getElementById('editAboutP2').value = aboutP2;
            }
        }
    }
    
    const savedServicesJSON = localStorage.getItem("arfianka_services");
    if(savedServicesJSON) {
        currentServices = JSON.parse(savedServicesJSON);
    }
    
    renderAdminServicesList();
    renderClientDropdown();
}

async function saveAboutText() {
    const secTitle = document.getElementById('editAboutSectionTitle').value;
    const name = document.getElementById('editAboutName').value;
    const role = document.getElementById('editAboutRole').value;
    const p1 = document.getElementById('editAboutP1').value;
    const p2 = document.getElementById('editAboutP2').value;
    const showImage = document.getElementById('editAboutShowImage').checked ? "true" : "false";
    try {
        await Promise.all([
            cmsSetItem("arfianka_about_section_title", secTitle),
            cmsSetItem("arfianka_about_show_image", showImage),
            cmsSetItem("arfianka_about_name", name),
            cmsSetItem("arfianka_about_role", role),
            cmsSetItem("arfianka_about_p1", p1),
            cmsSetItem("arfianka_about_p2", p2),
            cmsSetItem("arfianka_about_deleted", "false")
        ]);
        applyLocalEdits();
        alert("Saved in Firebase / Sačuvano u Firebase");
    } catch (error) {
        console.error("About text save failed", error);
        alert("Firestore save failed ["+(error.code||"unknown")+"]: "+(error.message||error));
    }
}

function deleteAboutText() {
    if(confirm("Delete 'About Us' section? / Da li ste sigurni da želite da obrišete sekciju 'O nama'?")) {
        cmsSetItem("arfianka_about_deleted", "true");
        applyLocalEdits();
        alert("The section is now hidden. / Sekcija je sada skrivena.");
    }
}

let editingServiceIndex = null;
function escapeServiceHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function renderAdminServicesList() {
    const listEl=document.getElementById('admin-services-list');
    const countEl=document.getElementById('serviceCount');
    if(!listEl)return;
    if(countEl)countEl.textContent=`${currentServices.length} services / usluga`;
    listEl.innerHTML='';
    if(!currentServices.length){listEl.innerHTML='<li class="services-empty">No services yet. / Još nema usluga.</li>';return;}
    currentServices.forEach((service,index)=>{
        const li=document.createElement('li');li.className='service-modern-row';
        if(editingServiceIndex===index){li.innerHTML=`<span class="service-index">${index+1}</span><div class="service-inline-edit"><input id="serviceEditInput-${index}" value="${escapeServiceHtml(service)}"><button class="service-save-btn" onclick="saveServiceEdit(${index})">Save / Sačuvaj</button><button class="service-cancel-btn" onclick="cancelServiceEdit()">Cancel / Otkaži</button></div>`;}
        else{li.innerHTML=`<span class="service-index">${index+1}</span><span class="service-name">${escapeServiceHtml(service)}</span><div class="service-actions"><button class="service-edit-btn" onclick="editService(${index})">Edit / Uredi</button><button class="service-delete-btn" onclick="deleteService(${index})">Delete / Obriši</button></div>`;}
        listEl.appendChild(li);
    });
    if(editingServiceIndex!==null){const input=document.getElementById(`serviceEditInput-${editingServiceIndex}`);if(input){input.focus();input.select();input.onkeydown=e=>{if(e.key==='Enter')saveServiceEdit(editingServiceIndex);if(e.key==='Escape')cancelServiceEdit();};}}
}

function renderClientDropdown() {
    const selectEl = document.getElementById('service');
    if (!selectEl) return;
    const langSel = document.getElementById('languageSelector');
    const currentLang = langSel ? langSel.value : 'sr';
    const selectPlaceholder = translations[currentLang] ? translations[currentLang]["form_opt_1"] : "Izaberite...";
    
    selectEl.innerHTML = `<option value="">${selectPlaceholder}</option>`;
    
    currentServices.forEach(service => {
        const opt = document.createElement('option');
        opt.value = service;
        opt.innerText = service;
        selectEl.appendChild(opt);
    });
}

function persistServices(){cmsSetItem("arfianka_services",JSON.stringify(currentServices));renderAdminServicesList();renderClientDropdown();}
function addNewService(){const nameEl=document.getElementById('newServiceInput'),priceEl=document.getElementById('newServicePrice');const name=nameEl.value.trim(),price=priceEl.value.trim();if(!name){alert("Please enter a service name. / Molimo unesite naziv usluge.");nameEl.focus();return;}const value=price?`${name} - ${price}`:name;if(currentServices.some(x=>x.toLowerCase()===value.toLowerCase())){alert("This service already exists. / Ova usluga već postoji.");return;}currentServices.push(value);nameEl.value='';priceEl.value='';persistServices();nameEl.focus();}
function editService(index){editingServiceIndex=index;renderAdminServicesList();}
function saveServiceEdit(index){const input=document.getElementById(`serviceEditInput-${index}`),value=input?input.value.trim():'';if(!value){alert("Service name cannot be empty. / Naziv usluge ne može biti prazan.");return;}currentServices[index]=value;editingServiceIndex=null;persistServices();}
function cancelServiceEdit(){editingServiceIndex=null;renderAdminServicesList();}
function deleteService(index){if(confirm(`Delete "${currentServices[index]}"? / Obrisati "${currentServices[index]}"?`)){currentServices.splice(index,1);editingServiceIndex=null;persistServices();}}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='newServiceInput'||e.target.id==='newServicePrice')){e.preventDefault();addNewService();}});

// =========================================================
// UI NAVIGATION
// =========================================================
function toggleMobileMenu() {
    const nav = document.getElementById('navLinks');
    if (nav) nav.classList.toggle('active');
}

function showPublicSite() {
    document.getElementById('public-site').style.display = 'block';
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'none';
    window.scrollTo(0,0);
}

function showAdminLogin() {
    document.getElementById('public-site').style.display = 'none';
    if (auth.currentUser) {
        showAdminDashboard();
    } else {
        document.getElementById('admin-login').style.display = 'flex';
        document.getElementById('admin-dashboard').style.display = 'none';
    }
    window.scrollTo(0,0);
}

function showAdminDashboard() {
    document.getElementById('public-site').style.display = 'none';
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    fetchBookings();
}

function switchAdminTab(tab){
    if(getCurrentRole()==='employee'&&tab!=='bookings')tab='bookings';
    ['bookings','settings','services','content','images','employees'].forEach(n=>{
        const b=document.getElementById('tab-btn-'+n),v=document.getElementById('admin-view-'+n);
        if(b)b.classList.toggle('active',n===tab);
        if(v)v.style.display=n===tab?'block':'none';
    });
    if(tab==='employees')renderStaffAccounts();
    if(tab==='settings')loadEmailConfiguration();
    renderExtendedCms();
}

// =========================================================
// FIREBASE INTEGRATED ACTIONS
// =========================================================
async function submitBooking(event) {
    event.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Sending... / Slanje...";

    const bookingData = {
        navn: document.getElementById('name').value,
        telefon: document.getElementById('phone').value,
        email: document.getElementById('customerEmail').value.trim(),
        tjeneste: document.getElementById('service').value,
        besked: document.getElementById('message').value,
        status: "New / Novo",
        dato: firebase.firestore.FieldValue.serverTimestamp(),
        datoIso: new Date().toISOString()
    };

    try {
        await db.collection("bookings").add(bookingData);
        try {
            const c=getEmailConfig();initEmailJS();
            const params={to_email:c.toEmail,to_name:"ArFiAnKA",from_name:bookingData.navn,from_email:bookingData.email,navn:bookingData.navn,telefon:bookingData.telefon,email:bookingData.email,customer_email:bookingData.email,reply_to:bookingData.email,tjeneste:bookingData.tjeneste,besked:bookingData.besked||"Ingen besked",message:bookingData.besked||"Ingen besked",dato:new Date(bookingData.datoIso).toLocaleString("da-DK")};
            await emailjs.send(c.serviceId,c.notificationTemplateId,params,{publicKey:c.publicKey});
            if(c.sendAutoReply&&c.autoReplyTemplateId){await emailjs.send(c.serviceId,c.autoReplyTemplateId,{...params,to_email:bookingData.email,to_name:bookingData.navn,reply_to:c.toEmail},{publicKey:c.publicKey});}
            alert("Booking saved and email sent. / Rezervacija je sačuvana i email je poslat.");
        } catch(emailError){console.error("EmailJS error:",emailError);alert("Booking saved in Firebase, but email notification failed: "+((emailError&&(emailError.text||emailError.message))||String(emailError)));}
        event.target.reset();
    } catch (error) {
        const detail=(error&&(error.text||error.message))||String(error);console.error(error);alert("Error / Greška: "+detail);
    }
    
    btn.disabled = false;
    const currentLang = document.getElementById('languageSelector').value;
    btn.innerText = translations[currentLang]["form_btn"];
}

const ADMIN_EMAIL="kucna.nega.arfianka@gmail.com";
const ADMIN_UID="YFkzMKYpkObxxijAM3mRK8tR6sC2";
let currentAccess={role:null,name:'',email:'',uid:''};
let staffCreatorApp=null;

function getCurrentRole(){return currentAccess.role||sessionStorage.getItem('arfianka_role')||'';}
function setAccess(role,name,email,uid){currentAccess={role,name,email,uid};sessionStorage.setItem('arfianka_role',role);sessionStorage.setItem('arfianka_name',name||'');sessionStorage.setItem('arfianka_email',email||'');sessionStorage.setItem('arfianka_uid',uid||'');}
function clearAccess(){currentAccess={role:null,name:'',email:'',uid:''};['arfianka_role','arfianka_name','arfianka_email','arfianka_uid'].forEach(k=>sessionStorage.removeItem(k));}

async function loadFirebaseRole(user){
    if ((user.email && user.email.trim().toLowerCase()===ADMIN_EMAIL.toLowerCase()) || user.uid===ADMIN_UID) return {role:'admin',name:'Administrator',active:true};
    const snap=await db.collection('staff').doc(user.uid).get();
    if(!snap.exists)throw new Error('No staff role assigned / Nema dodeljene uloge');
    const data=snap.data();
    if(data.active===false)throw new Error('Account is inactive / Nalog nije aktivan');
    return {role:data.role==='admin'?'admin':'employee',name:data.name||user.email,active:true};
}

function applyAccessUI(){
    const role=getCurrentRole(),name=currentAccess.name||sessionStorage.getItem('arfianka_name')||'';
    document.getElementById('admin-dashboard').classList.toggle('employee-mode',role==='employee');
    document.getElementById('adminBrand').textContent=role==='employee'?'ArFiAnKA STAFF':'ArFiAnKA ADMIN';
    document.getElementById('signedInInfo').textContent=`${name||'Administrator'} · ${role==='employee'?'Booking access / Pristup rezervacijama':'Full access / Pun pristup'}`;
    ['settings','services','content','images','employees'].forEach(n=>{const b=document.getElementById('tab-btn-'+n);if(b)b.style.display=role==='employee'?'none':'';});
    switchAdminTab('bookings');
}

async function loginAdmin(event){
    event.preventDefault();
    const email=document.getElementById('adminEmail').value.trim().toLowerCase();
    const pass=document.getElementById('adminPass').value;
    try{
        const result=await auth.signInWithEmailAndPassword(email,pass);
        const access=await loadFirebaseRole(result.user);
        setAccess(access.role,access.name,result.user.email,result.user.uid);
        showAdminDashboard();
        applyAccessUI();
    }catch(error){
        console.error('Firebase login error:',error);
        try{await auth.signOut();}catch(e){}
        alert('Login failed / Prijava nije uspela: '+(error.message||error));
    }
}

async function logoutAdmin(){clearAccess();try{await auth.signOut();}catch(e){}showPublicSite();}

function clearStaffForm(){
    ['staffAccountId','staffName','staffEmail','staffPassword'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('staffEmail').readOnly=false;
    document.getElementById('staffPassword').placeholder='';
    document.getElementById('staffActive').checked=true;
    document.getElementById('employeeFormTitle').textContent='Create employee / Kreiraj zaposlenog';
}

async function saveStaffAccount(){
    if(getCurrentRole()!=='admin')return;
    const uid=document.getElementById('staffAccountId').value;
    const name=document.getElementById('staffName').value.trim();
    const email=document.getElementById('staffEmail').value.trim().toLowerCase();
    const password=document.getElementById('staffPassword').value;
    const active=document.getElementById('staffActive').checked;
    if(!name||!email||(!uid&&password.length<6)){alert('Name, email and password of at least 6 characters are required. / Ime, email i lozinka od najmanje 6 znakova su obavezni.');return;}
    try{
        let staffUid=uid;
        if(!staffUid){
            if(!staffCreatorApp){try{staffCreatorApp=firebase.app('staffCreator');}catch(e){staffCreatorApp=firebase.initializeApp(firebaseConfig,'staffCreator');}}
            const secondaryAuth=staffCreatorApp.auth();
            const created=await secondaryAuth.createUserWithEmailAndPassword(email,password);
            staffUid=created.user.uid;
            await secondaryAuth.signOut();
        }
        await db.collection('staff').doc(staffUid).set({name,email,role:'employee',active,updatedAt:new Date().toISOString()},{merge:true});
        clearStaffForm();renderStaffAccounts();alert('Employee saved in Firebase. / Zaposleni je sačuvan u Firebase.');
    }catch(error){console.error(error);alert('Employee could not be saved / Zaposleni nije sačuvan: '+(error.message||error));}
}

async function renderStaffAccounts(){
    const box=document.getElementById('staffAccountsList');if(!box)return;
    box.innerHTML='<p style="color:#6b7280;">Loading... / Učitavanje...</p>';
    try{
        const snap=await db.collection('staff').orderBy('name').get();
        const items=[];snap.forEach(doc=>items.push({id:doc.id,...doc.data()}));
        box.innerHTML=items.length?items.map(x=>`<div class="employee-list-row"><div><strong>${escapeServiceHtml(x.name||'')}</strong><small>${escapeServiceHtml(x.email||'')}</small><br><span class="role-chip">${x.active===false?'Inactive / Neaktivan':'Active / Aktivan'}</span></div><div class="employee-actions"><button class="employee-edit" onclick="editStaffAccount('${x.id}')">Edit</button><button class="employee-toggle" onclick="toggleStaffAccount('${x.id}',${x.active===false})">${x.active===false?'Enable':'Disable'}</button><button class="employee-delete" onclick="deleteStaffAccount('${x.id}')">Remove role</button></div></div>`).join(''):'<p style="color:#6b7280;">No employee accounts. / Nema naloga zaposlenih.</p>';
    }catch(error){box.innerHTML=`<p style="color:#b42318;">${escapeServiceHtml(error.message||String(error))}</p>`;}
}

async function editStaffAccount(uid){const snap=await db.collection('staff').doc(uid).get();if(!snap.exists)return;const x=snap.data();document.getElementById('staffAccountId').value=uid;document.getElementById('staffName').value=x.name||'';document.getElementById('staffEmail').value=x.email||'';document.getElementById('staffEmail').readOnly=true;document.getElementById('staffPassword').value='';document.getElementById('staffPassword').placeholder='Password unchanged in Firebase Auth';document.getElementById('staffActive').checked=x.active!==false;document.getElementById('employeeFormTitle').textContent='Edit employee / Uredi zaposlenog';}
async function toggleStaffAccount(uid,enable){await db.collection('staff').doc(uid).set({active:enable,updatedAt:new Date().toISOString()},{merge:true});renderStaffAccounts();}
async function deleteStaffAccount(uid){if(!confirm('Remove employee access? The Firebase Auth user is not deleted. / Ukloniti pristup zaposlenom?'))return;await db.collection('staff').doc(uid).delete();renderStaffAccounts();}
let allBookings = [];
let bookingsUnsubscribe=null;
function bookingSafe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bookingStatusGroup(v){const x=String(v||'').toLowerCase();if(x.includes('cancel')||x.includes('otkaz'))return 'cancelled';if(x.includes('resolved')||x.includes('solved')||x.includes('reseno')||x.includes('rešeno'))return 'solved';return 'new';}
function normalizeBooking(doc){const d=doc||{};let date='-';const source=d.dato||d.datoIso||d.date||d.createdAt;if(source){try{const dt=source.toDate?source.toDate():new Date(source);if(!Number.isNaN(dt.getTime()))date=dt.toLocaleString('da-DK')}catch(e){}}return {navn:String(d.navn||d.name||'-'),telefon:String(d.telefon||d.phone||'-'),email:String(d.email||'-'),tjeneste:String(d.tjeneste||d.service||'-'),besked:String(d.besked||d.message||'-'),status:String(d.status||'New / Novo'),date};}
function fetchBookings(){const tbody=document.getElementById('bookingsTableBody');if(!tbody)return;tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:30px">Loading data... / Učitavanje podataka...</td></tr>';if(bookingsUnsubscribe)bookingsUnsubscribe();bookingsUnsubscribe=db.collection('bookings').orderBy('dato','desc').onSnapshot(snapshot=>{allBookings=[];snapshot.forEach(doc=>allBookings.push({id:doc.id,...normalizeBooking(doc.data())}));updateBookingKpis();applyBookingFilters();},error=>{console.error('Firestore error',error);tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:red;padding:30px">Database error: '+bookingSafe(error.message||error)+'</td></tr>';});}
function updateBookingKpis(){const by=id=>document.getElementById(id);if(by('kpiTotal'))by('kpiTotal').textContent=allBookings.length;if(by('kpiNew'))by('kpiNew').textContent=allBookings.filter(x=>bookingStatusGroup(x.status)==='new').length;if(by('kpiSolved'))by('kpiSolved').textContent=allBookings.filter(x=>bookingStatusGroup(x.status)==='solved').length;if(by('kpiCancelled'))by('kpiCancelled').textContent=allBookings.filter(x=>bookingStatusGroup(x.status)==='cancelled').length;}
function applyBookingFilters(){const q=(document.getElementById('bookingSearch')?.value||'').toLowerCase(),wanted=document.getElementById('bookingStatusFilter')?.value||'all',tbody=document.getElementById('bookingsTableBody');const rows=allBookings.filter(x=>{const hay=[x.navn,x.telefon,x.email,x.tjeneste,x.besked].join(' ').toLowerCase();return(!q||hay.includes(q))&&(wanted==='all'||bookingStatusGroup(x.status)===wanted)});tbody.innerHTML='';if(!rows.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:30px">No matching bookings / Nema rezervacija</td></tr>';return;}rows.forEach(x=>{try{renderTableRow(x.id,x,tbody)}catch(e){console.error('Row error',x,e)}});}
function clearBookingFilters(){const q=document.getElementById('bookingSearch'),f=document.getElementById('bookingStatusFilter');if(q)q.value='';if(f)f.value='all';applyBookingFilters();}
function renderTableRow(id,data,tbody){const group=bookingStatusGroup(data.status),badge=group==='cancelled'?'status-cancelled':(group==='solved'?'status-lost':'status-ny'),admin=getCurrentRole()==='admin',tr=document.createElement('tr');tr.innerHTML=`<td>${bookingSafe(data.date)}</td><td>${bookingSafe(data.navn)}</td><td>${data.telefon!=='-'?`<a href="tel:${bookingSafe(data.telefon)}">${bookingSafe(data.telefon)}</a>`:'-'}</td><td>${data.email!=='-'?`<a href="mailto:${bookingSafe(data.email)}">${bookingSafe(data.email)}</a>`:'-'}</td><td>${bookingSafe(data.tjeneste)}</td><td>${bookingSafe(data.besked)}</td><td><span class="status-badge ${badge}">${bookingSafe(data.status)}</span></td><td><div class="employee-actions">${group!=='solved'?`<button class="employee-edit" onclick="markAsDone('${id}')">Solved</button>`:''}${group!=='cancelled'?`<button class="employee-toggle" onclick="cancelBooking('${id}')">Cancel</button>`:''}${admin?`<button class="employee-delete admin-delete-action" onclick="deleteBooking('${id}')">Delete</button>`:''}</div></td>`;tbody.appendChild(tr);}

async function cancelBooking(id) {
    if (!auth.currentUser) { alert("You must be logged in. / Morate biti prijavljeni."); return; }
    if (!confirm("Cancel this booking? It will remain in the history. / Otkazati rezervaciju?")) return;
    try {
        await db.collection("bookings").doc(id).update({status:"Cancelled / Otkazano",cancelledAt:new Date().toISOString(),cancelledBy:auth.currentUser.email||auth.currentUser.uid});
    } catch (error) {
        console.error("Cancel booking failed", error);
        alert("Cancel failed / Otkazivanje nije uspelo: " + (error.message || error));
    }
}

async function deleteBooking(id) {
    if (!auth.currentUser) { alert("You must be logged in. / Morate biti prijavljeni."); return; }
    if (getCurrentRole() !== "admin") { alert("Only the administrator can delete bookings. / Samo administrator može obrisati rezervaciju."); return; }
    const booking = allBookings.find(item => item.id === id);
    const label = booking ? `${booking.navn} - ${booking.tjeneste}` : id;
    if (!confirm(`Delete this booking permanently?\n${label}\n\nThis cannot be undone. / Ovo se ne može poništiti.`)) return;
    try {
        await db.collection("bookings").doc(id).delete();
        allBookings = allBookings.filter(item => item.id !== id);
        updateBookingKpis();
        applyBookingFilters();
        alert("Booking deleted. / Rezervacija je obrisana.");
    } catch (error) {
        console.error("Delete booking failed", error);
        const detail = error && (error.code || error.message) ? `${error.code || ""} ${error.message || ""}`.trim() : String(error);
        alert("Delete failed / Brisanje nije uspelo: " + detail + "\n\nIf the message says permission-denied, Firestore rules must allow delete for signed-in administrators.");
    }
}

async function markAsDone(id) {
    if (!auth.currentUser) { alert("You must be logged in. / Morate biti prijavljeni."); return; }
    try {
        await db.collection("bookings").doc(id).update({status:"Resolved / Rešeno",resolvedAt:new Date().toISOString(),resolvedBy:auth.currentUser.email||auth.currentUser.uid});
    } catch (error) {
        console.error("Resolve booking failed",error);
        alert("Error updating status: "+((error&&(error.code||error.message))||String(error)));
    }
}

const xget=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch(e){return f}},xset=(k,v)=>{cmsSetItem(k,JSON.stringify(v)).then(()=>console.info('Saved in Firebase:',k)).catch(e=>{console.error(e);alert('Firebase save failed: '+(e.code||e.message||e))});renderExtendedCms()},xe=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultServices=[{id:1,title:'Onlajn sastanak za sigurnost',description:'Razgovor preko računara/tableta o zdravlju, blagostanju ili praktičnim izazovima.',price:'',image:'',visible:true},{id:2,title:'Praktična i lična nega',description:'Pomoć pri kupovini, kuvanju i ličnoj higijeni sa poštovanjem i dostojanstvom.',price:'',image:'',visible:true},{id:3,title:'Zdravstveno savetovanje',description:'Ovlašćena procena, upravljanje lekovima i dijalog sa opštinom/lekarom.',price:'',image:'',visible:true}];

let lib=xget('arfianka_library',[{id:'default-logo',name:'Current logo',src:'a3b1c038-c74c-49f8-801e-e018737ac673.jpg',category:'site'},{id:'default-profile',name:'Current profile',src:'Kri.jpg',category:'site'}]);
let layout=xget('arfianka_layout_plus',{logo:'default-logo',profile:'default-profile',hero:'',logoHeight:76,heroHeight:700,heroZoom:100,heroX:50,heroY:50,profileHeight:450,profileX:50,profileY:20,profileFit:'cover'});
const libSrc=id=>lib.find(x=>x.id===id)?.src||'';

function saveLinkedService(){let a=xget('arfianka_linked_services',defaultServices),id=+document.getElementById('svcId').value,o={id:id||Date.now(),title:document.getElementById('svcTitle').value.trim(),description:document.getElementById('svcDesc').value.trim(),price:document.getElementById('svcPrice').value.trim(),image:document.getElementById('svcImage').value,visible:document.getElementById('svcVisible').checked},i=a.findIndex(x=>x.id===id);if(!o.title)return alert('Title required');i>=0?a[i]=o:a.push(o);xset('arfianka_linked_services',a);clearLinkedService()}
function editLinkedService(id){let x=xget('arfianka_linked_services',defaultServices).find(v=>v.id===id);if(!x)return;document.getElementById('svcId').value=x.id;document.getElementById('svcTitle').value=x.title;document.getElementById('svcDesc').value=x.description;document.getElementById('svcPrice').value=x.price;document.getElementById('svcImage').value=x.image;document.getElementById('svcVisible').checked=x.visible}
function clearLinkedService(){document.getElementById('svcId').value=document.getElementById('svcTitle').value=document.getElementById('svcDesc').value=document.getElementById('svcPrice').value=''}
function toggleX(k,id){let a=xget(k,[]),e=a.find(v=>v.id===id);if(e)e.visible=!e.visible;xset(k,a)}
function deleteX(k,id){if(confirm('Delete?'))xset(k,xget(k,[]).filter(x=>x.id!==id))}
function moveX(k,id,d){let a=xget(k,[]),i=a.findIndex(x=>x.id===id),j=i+d;if(i>=0&&j>=0&&j<a.length){[a[i],a[j]]=[a[j],a[i]];xset(k,a)}}
function bookService(t){const s=document.getElementById('service'); if(s)s.value=t; const b=document.getElementById('book'); if(b)b.scrollIntoView({behavior:'smooth'})}
function saveContactInfo(){xset('arfianka_contact_plus',{phone:document.getElementById('contactPhone').value,email:document.getElementById('contactEmail').value,address:document.getElementById('contactAddress').value,visible:document.getElementById('contactVisible').checked})}

function updateEmployeePreview(){
    const empPreview = document.getElementById('empPreview');
    const empHeight = document.getElementById('empHeight').value;
    const empX = document.getElementById('empX').value;
    const empY = document.getElementById('empY').value;
    const empFit = document.getElementById('empFit').value;
    const empImage = document.getElementById('empImage').value;
    if(!empPreview)return;
    document.getElementById('empHeightOut').value=empHeight+'px';
    document.getElementById('empXOut').value=empX+'%';
    document.getElementById('empYOut').value=empY+'%';
    empPreview.style.height=empHeight+'px';
    empPreview.style.width='220px';
    empPreview.style.objectFit=empFit;
    empPreview.style.objectPosition=empX+'% '+empY+'%';
    if(empImage){
        empPreview.src=empImage;
        empPreview.style.display='block';
    } else {
        empPreview.style.display='none';
    }
}

function previewSelectedEmployeeImage(){ updateEmployeePreview(); }

async function saveEmployee(){
    try{
        let a=xget('arfianka_employees_plus',[]);
        let id=+document.getElementById('empId').value;
        let o={
            id:id||Date.now(),
            name:document.getElementById('empName').value,
            role:document.getElementById('empRole').value,
            phone:document.getElementById('empPhone').value,
            email:document.getElementById('empEmail').value,
            image:document.getElementById('empImage').value,
            height:+document.getElementById('empHeight').value,
            x:+document.getElementById('empX').value,
            y:+document.getElementById('empY').value,
            fit:document.getElementById('empFit').value,
            visible:document.getElementById('empVisible').checked
        };
        let i=a.findIndex(x=>x.id===id);
        if(!o.name)return alert('Name required');
        i>=0 ? a[i]=o : a.push(o);
        xset('arfianka_employees_plus',a);
        clearEmployee();
    }catch(error){
        console.error(error);
        alert('Firebase save failed: '+(error.code||error.message||error));
    }
}

function editEmployee(id){
    let x=xget('arfianka_employees_plus',[]).find(v=>v.id===id);
    if(!x)return;
    document.getElementById('empId').value=x.id;
    document.getElementById('empName').value=x.name;
    document.getElementById('empRole').value=x.role;
    document.getElementById('empPhone').value=x.phone;
    document.getElementById('empEmail').value=x.email;
    document.getElementById('empImage').value=x.image;
    document.getElementById('empHeight').value=x.height;
    document.getElementById('empX').value=x.x;
    document.getElementById('empY').value=x.y;
    document.getElementById('empFit').value=x.fit;
    document.getElementById('empVisible').checked=x.visible;
    updateEmployeePreview();
}

function clearEmployee(){
    document.getElementById('empId').value=document.getElementById('empName').value=document.getElementById('empRole').value=document.getElementById('empPhone').value=document.getElementById('empEmail').value='';
    document.getElementById('empImage').value='';
    document.getElementById('empPreview').style.display='none';
}

function saveModule(){let a=xget('arfianka_modules_plus',[]),id=+document.getElementById('modId').value,o={id:id||Date.now(),title:document.getElementById('modTitle').value,text:document.getElementById('modText').value,link:document.getElementById('modLink').value,image:document.getElementById('modImage').value,visible:document.getElementById('modVisible').checked},i=a.findIndex(x=>x.id===id);i>=0?a[i]=o:a.push(o);xset('arfianka_modules_plus',a);clearModule()}
function editModuleX(id){let x=xget('arfianka_modules_plus',[]).find(v=>v.id===id);if(!x)return;document.getElementById('modId').value=x.id;document.getElementById('modTitle').value=x.title;document.getElementById('modText').value=x.text;document.getElementById('modLink').value=x.link;document.getElementById('modImage').value=x.image;document.getElementById('modVisible').checked=x.visible}
function clearModule(){document.getElementById('modId').value=document.getElementById('modTitle').value=document.getElementById('modText').value=document.getElementById('modLink').value=''}

async function uploadLibraryImages(){
    if(!auth.currentUser)return alert('Please log in as administrator first.');
    const cat = document.getElementById('uploadCategory').value;
    const uploadFolder = cat === 'employee' ? 'employees' : 'library';
    
    try{
        const added=[];
        const files = document.getElementById('imageUpload').files;
        if(files.length === 0) return alert("Vælg et billede først.");
        
        for(const file of [...files]){
            const url=await uploadFileToFirebase(file, uploadFolder);
            added.push({id:Date.now()+'-'+Math.random(), name:file.name, src:url, category: cat});
        }
        lib.push(...added); 
        xset('arfianka_library',lib); 
        document.getElementById('imageUpload').value='';
        alert('Images saved in Firebase Storage.');
    }catch(error){
        console.error(error);
        alert('Firebase Storage failed: '+(error.code||error.message||error));
    }
}

function assignLib(id,t){layout[t]=id;xset('arfianka_layout_plus',layout)}
function renameLib(id,n){let x=lib.find(v=>v.id===id);if(x)x.name=n;xset('arfianka_library',lib)}
function deleteLib(id){if([layout.logo,layout.profile,layout.hero].includes(id))return alert('Assign another image first');lib=lib.filter(x=>x.id!==id);xset('arfianka_library',lib)}

function saveLayoutControls(){layout={...layout,logoHeight:+document.getElementById('logoHeight').value,heroHeight:+document.getElementById('heroHeight').value,heroZoom:+document.getElementById('heroZoom').value,heroX:+document.getElementById('heroX').value,heroY:+document.getElementById('heroY').value,profileHeight:+document.getElementById('profileHeight').value,profileX:+document.getElementById('profileX').value,profileY:+document.getElementById('profileY').value,profileFit:document.getElementById('profileFit').value};xset('arfianka_layout_plus',layout)}
function resetLayoutControls(){layout={logo:'default-logo',profile:'default-profile',hero:'',logoHeight:76,heroHeight:700,heroZoom:100,heroX:50,heroY:50,profileHeight:450,profileX:50,profileY:20,profileFit:'cover'};xset('arfianka_layout_plus',layout)}

function renderExtendedCms(){
    const dynamicServices=document.getElementById('dynamic-services');
    lib=xget('arfianka_library',lib);
    layout=xget('arfianka_layout_plus',layout);
    let sv=xget('arfianka_linked_services',defaultServices),visible=sv.filter(x=>x.visible);
    
    if(dynamicServices) {
        dynamicServices.innerHTML=visible.map(x=>`<article class="service-card" role="button" tabindex="0" onclick="bookService('${xe(x.title).replace(/'/g,"\\'")}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();bookService('${xe(x.title).replace(/'/g,"\\'")}')}">${x.image?`<img src="${xe(x.image)}" style="width:100%;height:180px;object-fit:cover;border-radius:8px">`:''}<h3>${xe(x.title)}</h3><p>${xe(x.description)}</p><p style="color:var(--primary-gold);font-weight:bold">${xe(x.price)}</p><button type="button" class="btn-solid service-book-btn" onclick="event.stopPropagation();bookService('${xe(x.title).replace(/'/g,"\\'")}')">Book / Zakaži</button></article>`).join('');
    }
    
    const serviceDropdown=document.getElementById('service');
    if (serviceDropdown) {
        const langSel = document.getElementById('languageSelector');
        const currentLang = langSel ? langSel.value : 'sr';
        const selectPlaceholder = translations[currentLang] ? translations[currentLang]["form_opt_1"] : "Izaberite...";
        serviceDropdown.innerHTML=`<option value="">${selectPlaceholder}</option>`+visible.map(x=>`<option value="${xe(x.title)}">${xe(x.title)}${x.price?' - '+xe(x.price):''}</option>`).join('');
    }
    
    const svcManager = document.getElementById('svcManager');
    if(svcManager) {
        svcManager.innerHTML=sv.map(x=>`<div class="cms-row"><span><b>${xe(x.title)}</b><br>${xe(x.description)} (${x.visible?'Visible':'Hidden'})</span><span class="cms-actions"><button class="btn-small" onclick="editLinkedService(${x.id})">Edit</button><button class="btn-small" onclick="toggleX('arfianka_linked_services',${x.id})">Show/Hide</button><button class="btn-small" onclick="moveX('arfianka_linked_services',${x.id},-1)">Up</button><button class="btn-small" onclick="moveX('arfianka_linked_services',${x.id},1)">Down</button><button class="btn-small btn-danger" onclick="deleteX('arfianka_linked_services',${x.id})">Delete</button></span></div>`).join('');
    }
    
    let c=xget('arfianka_contact_plus',{phone:'',email:'',address:'',visible:false});
    const contactPublicSection=document.getElementById('contact-public-section');
    if (contactPublicSection) {
        contactPublicSection.style.display=c.visible?'block':'none';
        document.getElementById('contact-public').innerHTML=`<a href="tel:${xe(c.phone)}">☎ ${xe(c.phone)}</a><a href="mailto:${xe(c.email)}">✉ ${xe(c.email)}</a><div>${xe(c.address)}</div>`;
    }
    const contactPhoneEl=document.getElementById('contactPhone');
    if(contactPhoneEl){
        contactPhoneEl.value=c.phone;
        document.getElementById('contactEmail').value=c.email;
        document.getElementById('contactAddress').value=c.address;
        document.getElementById('contactVisible').checked=c.visible;
    }
    
    let es=xget('arfianka_employees_plus',[]);
    const empSection = document.getElementById('employees-public-section');
    if (empSection) {
        empSection.style.display=es.some(x=>x.visible)?'block':'none';
        document.getElementById('employees-public').innerHTML=es.filter(x=>x.visible).map(x=>`<article class="feature-card"><img src="${xe(x.image)}" style="height:${x.height}px;object-fit:${x.fit};object-position:${x.x}% ${x.y}%"><h3>${xe(x.name)}</h3><p>${xe(x.role)}</p><a href="tel:${xe(x.phone)}">${xe(x.phone)}</a><br><a href="mailto:${xe(x.email)}">${xe(x.email)}</a></article>`).join('');
    }
    const empManagerEl = document.getElementById('empManager');
    if(empManagerEl) {
        empManagerEl.innerHTML=es.map(x=>`<div class="cms-row"><span>${xe(x.name)} (${x.visible?'Visible':'Hidden'})</span><span><button class="btn-small" onclick="editEmployee(${x.id})">Edit</button><button class="btn-small" onclick="toggleX('arfianka_employees_plus',${x.id})">Show/Hide</button><button class="btn-small btn-danger" onclick="deleteX('arfianka_employees_plus',${x.id})">Delete</button></span></div>`).join('');
    }
    
    let ms=xget('arfianka_modules_plus',[]);
    const modSection = document.getElementById('modules-public-section');
    if (modSection) {
        modSection.style.display=ms.some(x=>x.visible)?'block':'none';
        document.getElementById('modules-public').innerHTML=ms.filter(x=>x.visible).map(x=>`<article class="feature-card">${x.image?`<img src="${xe(x.image)}">`:''}<h3>${xe(x.title)}</h3><p>${xe(x.text)}</p>${x.link?`<a href="${xe(x.link)}" target="_blank">Read more</a>`:''}</article>`).join('');
    }
    const modManagerEl = document.getElementById('modManager');
    if(modManagerEl) {
        modManagerEl.innerHTML=ms.map(x=>`<div class="cms-row"><span>${xe(x.title)} (${x.visible?'Visible':'Hidden'})</span><span><button class="btn-small" onclick="editModuleX(${x.id})">Edit</button><button class="btn-small" onclick="toggleX('arfianka_modules_plus',${x.id})">Show/Hide</button><button class="btn-small btn-danger" onclick="deleteX('arfianka_modules_plus',${x.id})">Delete</button></span></div>`).join('');
    }

    const siteLib = lib.filter(x => !x.category || x.category === 'site');
    const empLib = lib.filter(x => x.category === 'employee');
    
    const imageLibrarySiteEl = document.getElementById('imageLibrarySite');
    if(imageLibrarySiteEl) {
        imageLibrarySiteEl.innerHTML = siteLib.map(x => `
            <div class="image-box">
                <img src="${xe(x.src)}">
                <input value="${xe(x.name)}" onchange="renameLib('${x.id}',this.value)">
                <div class="cms-actions">
                    <button class="btn-small" onclick="assignLib('${x.id}','logo')">Logo</button>
                    <button class="btn-small" onclick="assignLib('${x.id}','hero')">Hero</button>
                    <button class="btn-small" onclick="assignLib('${x.id}','profile')">Profil</button>
                    <button class="btn-small btn-danger" onclick="deleteLib('${x.id}')">Slet</button>
                </div>
            </div>
        `).join('');
    }

    const imageLibraryEmpEl = document.getElementById('imageLibraryEmployee');
    if(imageLibraryEmpEl) {
        imageLibraryEmpEl.innerHTML = empLib.map(x => `
            <div class="image-box">
                <img src="${xe(x.src)}">
                <input value="${xe(x.name)}" onchange="renameLib('${x.id}',this.value)">
                <div class="cms-actions">
                    <button class="btn-small btn-danger" onclick="deleteLib('${x.id}')" style="flex:100%;">Slet billede</button>
                </div>
            </div>
        `).join('');
    }

    const optsSite = '<option value="">Intet billede</option>' + siteLib.map(x => `<option value="${xe(x.src)}">${xe(x.name)}</option>`).join('');
    const optsEmp = '<option value="">Intet billede</option>' + empLib.map(x => `<option value="${xe(x.src)}">${xe(x.name)}</option>`).join('');

    if (document.getElementById('svcImage')) document.getElementById('svcImage').innerHTML = optsSite;
    if (document.getElementById('modImage')) document.getElementById('modImage').innerHTML = optsSite;
    if (document.getElementById('empImage')) document.getElementById('empImage').innerHTML = optsEmp;
    
    let logo=document.getElementById('site-logo'),profile=document.getElementById('site-profile-pic'),hero=document.getElementById('forside');
    if (logo) {
        logo.src=libSrc(layout.logo)||logo.src;
        logo.style.height=layout.logoHeight+'px';
    }
    if (profile) {
        profile.style.backgroundImage=`url("${libSrc(layout.profile)||'Kri.jpg'}")`;
        profile.style.minHeight=layout.profileHeight+'px';
        profile.style.backgroundPosition=`${layout.profileX}% ${layout.profileY}%`;
        profile.style.backgroundSize=layout.profileFit;
    }
    if (hero) {
        hero.style.height=layout.heroHeight+'px';
        if(libSrc(layout.hero))hero.style.background=`linear-gradient(rgba(13,44,84,.75),rgba(13,44,84,.75)),url("${libSrc(layout.hero)}") ${layout.heroX}% ${layout.heroY}%/${layout.heroZoom}% no-repeat`;
    }
    
    const logoHeightEl = document.getElementById('logoHeight');
    if(logoHeightEl){
        for(let [id,v,u] of [['logoHeight',layout.logoHeight,'px'],['heroHeight',layout.heroHeight,'px'],['heroZoom',layout.heroZoom,'%'],['heroX',layout.heroX,'%'],['heroY',layout.heroY,'%'],['profileHeight',layout.profileHeight,'px'],['profileX',layout.profileX,'%'],['profileY',layout.profileY,'%']]){
            const el = document.getElementById(id);
            if (el) el.value=v;
            const outEl = document.getElementById(id+'Out');
            if (outEl) outEl.value=v+u;
        }
        document.getElementById('profileFit').value=layout.profileFit;
    }
}

document.addEventListener('DOMContentLoaded',async()=>{await firebaseCmsReady;renderExtendedCms();});

function loadEmailConfiguration(){
    const c=getEmailConfig();
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||""};
    set("emailServiceId",c.serviceId);
    set("emailPublicKey",c.publicKey);
    set("emailNotificationTemplateId",c.notificationTemplateId);
    set("emailAutoReplyTemplateId",c.autoReplyTemplateId);
    set("emailToAddress",c.toEmail);
    const test=document.getElementById("emailTestRecipient");
    if(test&&!test.value)test.value=c.toEmail;
    const enabled=document.getElementById("emailAutoReplyEnabled");
    if(enabled)enabled.checked=!!c.sendAutoReply;
}

function saveEmailConfiguration(){
    const c={
        serviceId:document.getElementById('emailServiceId').value.trim(),
        publicKey:document.getElementById('emailPublicKey').value.trim(),
        notificationTemplateId:document.getElementById('emailNotificationTemplateId').value.trim(),
        autoReplyTemplateId:document.getElementById('emailAutoReplyTemplateId').value.trim(),
        toEmail:document.getElementById('emailToAddress').value.trim(),
        sendAutoReply:document.getElementById('emailAutoReplyEnabled').checked
    };
    cmsSetItem("arfianka_email_config",JSON.stringify(c));
    initEmailJS();
    const status = document.getElementById('emailTestStatus');
    if (status) {
        status.textContent="Email settings saved in this browser.";
        status.style.background="#d4edda";
    }
}

function emailTestParams(to){return {to_email:to,to_name:"ArFiAnKA test",from_name:"ArFiAnKA",from_email:getEmailConfig().toEmail,navn:"ArFiAnKA test",telefon:"-",email:to,customer_email:to,reply_to:getEmailConfig().toEmail,tjeneste:"EmailJS test",besked:"Test sent from the ArFiAnKA admin panel",message:"Test sent from the ArFiAnKA admin panel",dato:new Date().toLocaleString("da-DK")}}

async function runEmailTest(templateId,to,label){
    const c=getEmailConfig();
    const status = document.getElementById('emailTestStatus');
    if(status) {
        status.textContent="Testing "+label+"...";
        status.style.background="#fff3cd";
    }
    try{
        initEmailJS();
        const response=await emailjs.send(c.serviceId,templateId,emailTestParams(to),{publicKey:c.publicKey});
        if(status) {
            status.textContent=label+" sent successfully. Status: "+response.status;
            status.style.background="#d4edda";
        }
    }catch(error){
        console.error(label+" failed",error);
        if(status) {
            status.textContent=label+" failed: "+((error&&(error.text||error.message))||String(error));
            status.style.background="#f8d7da";
        }
    }
}

async function testAdminNotification(){saveEmailConfiguration();const c=getEmailConfig();await runEmailTest(c.notificationTemplateId,c.toEmail,"Admin notification")}
async function testCustomerAutoReply(){
    saveEmailConfiguration();
    const c=getEmailConfig();
    const el = document.getElementById('emailTestRecipient');
    const to = el ? el.value.trim() : '';
    if(!to)return alert("Enter a test customer email");
    await runEmailTest(c.autoReplyTemplateId,to,"Customer Auto-Reply")
}

document.addEventListener("DOMContentLoaded",async()=>{await firebaseCmsReady;loadEmailConfiguration();});

auth.onAuthStateChanged(async function(user) {
    if (!user) {
        clearAccess();
        return;
    }
    try {
        const access = await loadFirebaseRole(user);
        setAccess(access.role, access.name, user.email || '', user.uid);
        const dash = document.getElementById('admin-dashboard');
        if (dash && dash.style.display === 'block') {
            applyAccessUI();
        }
    } catch (error) {
        console.error('Role restoration failed:', error);
        clearAccess();
        try { await auth.signOut(); } catch (signOutError) {}
    }
});
