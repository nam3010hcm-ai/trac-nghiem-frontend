import { initData, $, TEACHER_PASS } from './common.js';
import { populateCategoryDropdowns, updateFltSubcat, updateQFormSubcat, updateEFormSubcat, addParentCategory, deleteParentCategory, addSubCategory, deleteSubCategory, editSubCategory, restoreDefaultCategories, renderCatManagementList } from './categories.js';
import { openQForm, closeQForm, saveQ, deleteQ, renderQuestions } from './questions.js';
import { openEForm, closeEForm, saveExam, deleteExam, toggleExamVisibility, renderExams, populateExamSelect } from './exams.js';
import { renderResults, clearResults, exportCSV } from './results.js';

function doLogin(){
  const pass = $('t-pass').value;
  if(pass === TEACHER_PASS){
    $('t-login').style.display = 'none';
    $('t-panel').style.display = 'block';
    renderQuestions();
    renderExams();
    renderResults();
    renderCatManagementList();
  } else $('t-err').style.display = 'block';
}

function doLogout(){
  $('t-login').style.display = 'block';
  $('t-panel').style.display = 'none';
  $('t-pass').value = '';
  $('t-err').style.display = 'none';
}

function switchTTab(t){
  ['q','e','r','c'].forEach(x => {
    $('tc-'+x).classList.toggle('active', x === t);
    document.querySelector(`.tab-btn[data-tab="${x}"]`).classList.toggle('active', x === t);
  });
  if(t === 'r') renderResults();
  if(t === 'c') renderCatManagementList();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initData();
  populateCategoryDropdowns();
  updateFltSubcat();
  updateQFormSubcat();
  updateEFormSubcat();
  populateExamSelect();

  $('btn-login').addEventListener('click', doLogin);
  $('t-pass').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
  $('btn-logout').addEventListener('click', doLogout);

  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTTab(btn.dataset.tab)));

  $('flt-cat').addEventListener('change', updateFltSubcat);
  $('qf-cat').addEventListener('change', updateQFormSubcat);
  $('ef-cat').addEventListener('change', updateEFormSubcat);
  $('btn-filter-q').addEventListener('click', renderQuestions);

  $('btn-open-qform').addEventListener('click', () => openQForm());
  $('btn-close-qform').addEventListener('click', closeQForm);
  $('btn-save-q').addEventListener('click', saveQ);

  $('q-list').addEventListener('click', e => {
    const btn = e.target.closest('.q-action');
    if(!btn) return;
    const id = parseInt(btn.dataset.id);
    if(btn.dataset.action === 'edit') openQForm(id);
    if(btn.dataset.action === 'delete') deleteQ(id);
  });

  $('btn-open-eform').addEventListener('click', openEForm);
  $('btn-close-eform').addEventListener('click', closeEForm);
  $('btn-save-exam').addEventListener('click', saveExam);

  $('e-list').addEventListener('click', e => {
    const btn = e.target.closest('.e-action');
    if(!btn) return;
    const id = parseInt(btn.dataset.id);
    if(btn.dataset.action === 'toggle') toggleExamVisibility(id);
    if(btn.dataset.action === 'delete') deleteExam(id);
  });

  $('btn-add-parent').addEventListener('click', addParentCategory);
  $('btn-add-sub').addEventListener('click', addSubCategory);
  $('btn-restore').addEventListener('click', restoreDefaultCategories);

  $('cat-management-list').addEventListener('click', e => {
    const btn = e.target.closest('.cat-action');
    if(!btn) return;
    const parent = btn.dataset.parent;
    const sub = btn.dataset.sub;
    if(btn.dataset.action === 'delete-parent') deleteParentCategory(parent);
    if(btn.dataset.action === 'edit-sub') editSubCategory(parent, sub);
    if(btn.dataset.action === 'delete-sub') deleteSubCategory(parent, sub);
  });

  $('btn-export').addEventListener('click', exportCSV);
  $('btn-clear-results').addEventListener('click', clearResults);
});
