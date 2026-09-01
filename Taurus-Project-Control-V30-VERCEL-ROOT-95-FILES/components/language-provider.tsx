"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "ku" | "ar";

const ku: Record<string, string> = {
  "English": "ئینگلیزی",
  "Kurdish Sorani": "کوردی سۆرانی",
  "Arabic": "عەرەبی",
  "Taurus Project Control": "کۆنترۆڵی پڕۆژەی تاوروس",
  "CONTROLLED DATA PORTAL": "پۆرتاڵی داتای کۆنترۆڵکراو",
  "PROJECT ASSURANCE PLATFORM": "پلاتفۆرمی دڵنیایی پڕۆژە",
  "PROJECT CONTROL": "کۆنترۆڵی پڕۆژە",
  "ADMINISTRATION": "بەڕێوەبەرایەتی",
  "Executive Overview": "پوختەی بەڕێوەبەرایەتی",
  "Document Control": "کۆنترۆڵی بەڵگەنامە",
  "Progress & S-Curves": "پێشکەوتن و هێڵەکانی S",
  "Project Schedule": "خشتەی کاتی پڕۆژە",
  "Import & Publish": "هاوردەکردن و بڵاوکردنەوە",
  "User Access": "دەستگەیشتنی بەکارهێنەر",
  "Activity Log": "تۆماری چالاکی",
  "ACTIVE PROJECT": "پڕۆژەی چالاک",
  "Published data": "داتای بڵاوکراو",
  "Awaiting first publish": "چاوەڕێی یەکەم بڵاوکردنەوە",
  "DATA DATE": "بەرواری داتا",
  "PROGRESS DATA DATE": "بەرواری داتای پێشکەوتن",
  "SCHEDULE DATA DATE": "بەرواری داتای خشتەی کات",
  "Data date": "بەرواری داتا",
  "Not published": "بڵاونەکراوەتەوە",
  "Sign out": "چوونەدەرەوە",
  "EXECUTIVE CONTROL ROOM": "ژووری کۆنترۆڵی بەڕێوەبەرایەتی",
  "Project performance overview": "پوختەی ئەدای پڕۆژە",
  "Latest controlled progress, document status, and schedule position.": "نوێترین پێشکەوتنی کۆنترۆڵکراو، دۆخی بەڵگەنامە و بارودۆخی خشتەی کات.",
  "Export briefing": "هەناردەکردنی پوختە",
  "Actual progress": "پێشکەوتنی ڕاستەقینە",
  "Baseline progress": "پێشکەوتنی بنچینە",
  "Earned to data date": "بەدەستهاتوو تا بەرواری داتا",
  "Approved baseline at data date": "بنچینەی پەسەندکراو لە بەرواری داتا",
  "Schedule variance": "جیاوازی خشتەی کات",
  "Actual minus baseline": "ڕاستەقینە کەم بنچینە",
  "Expected finish": "کۆتایی چاوەڕوانکراو",
  "Baseline-performance forecast": "پێشبینی بە پێی ئەدای بنچینە",
  "Controlled documents": "بەڵگەنامە کۆنترۆڵکراوەکان",
  "Critical activities": "چالاکییە گرنگەکان",
  "PERFORMANCE CURVE": "هێڵی ئەدا",
  "Overall cumulative S-curve": "هێڵی S کەڵەکەبووی گشتی",
  "Baseline vs actual": "بنچینە بەرامبەر ڕاستەقینە",
  "CONTROL STATUS": "دۆخی کۆنترۆڵ",
  "Management signal": "نیشانەی بەڕێوەبەرایەتی",
  "SCHEDULE STATUS": "دۆخی خشتەی کات",
  "Ahead of baseline": "لە بنچینە پێشەوەیە",
  "On baseline": "لەسەر بنچینەیە",
  "Slightly behind baseline": "کەمێک لە بنچینە دواوەیە",
  "Behind baseline": "لە بنچینە دواوەیە",
  "Pending data": "چاوەڕێی داتا",
  "Schedule status": "دۆخی خشتەی کات",
  "Total": "کۆی گشتی",
  "All": "هەموو",
  "curves": "هێڵ",
  "Baseline position": "شوێنی بنچینە",
  "Actual achieved": "ڕاستەقینەی بەدەستهاتوو",
  "Forecast variance": "جیاوازی پێشبینی",
  "Workbook structure recognized": "پێکهاتەی فایلەکە ناسراوە",
  "DOCUMENT REGISTER": "تۆماری بەڵگەنامە",
  "Distribution by discipline": "دابەشبوون بە پێی دیسیپلین",
  "RESPONSIBILITY": "بەرپرسیارێتی",
  "Current document action": "کردەوەی ئێستای بەڵگەنامە",
  "PROGRESS ANALYTICS": "شیکردنەوەی پێشکەوتن",
  "Monthly and weekly performance": "ئەدای مانگانە و هەفتانە",
  "Approved baseline and actual cumulative achievement with schedule forecast controls.": "بنچینەی پەسەندکراو و پێشکەوتنی ڕاستەقینەی کەڵەکەبوو لەگەڵ کۆنترۆڵی پێشبینی خشتەی کات.",
  "Year · month · week": "ساڵ · مانگ · هەفتە",
  "Actual": "ڕاستەقینە",
  "Baseline": "بنچینە",
  "Approved baseline": "بنچینەی پەسەندکراو",
  "Actual cumulative": "ڕاستەقینەی کەڵەکەبوو",
  "Cumulative progress": "پێشکەوتنی کەڵەکەبوو",
  "At current data date": "لە بەرواری داتای ئێستا",
  "SPI": "SPI",
  "SV": "SV",
  "Expected completion from baseline duration ÷ SPI": "کۆتایی چاوەڕوانکراو لە ماوەی بنچینە ÷ SPI",
  "FORECAST METHOD": "شێوازی پێشبینی",
  "Baseline performance forecast": "پێشبینی ئەدای بنچینە",
  "Expected finish uses approved baseline duration divided by the same-date SPI. No current-plan values are used.": "کۆتایی چاوەڕوانکراو ماوەی بنچینەی پەسەندکراو بە SPIی هەمان بەروار دابەش دەکات. هیچ نرخی پلانی ئێستا بەکارناهێنرێت.",
  "STATUS THRESHOLDS": "سنوورەکانی دۆخ",
  "Controlled schedule signal": "نیشانەی خشتەی کاتی کۆنترۆڵکراو",
  "Ahead > 1.01": "پێشەوە > 1.01",
  "On baseline 0.99–1.01": "لەسەر بنچینە 0.99–1.01",
  "Slight delay 0.96–0.99": "دواکەوتنی کەم 0.96–0.99",
  "Delayed < 0.96": "دواکەوتوو < 0.96",
  "CONTROLLED PROGRESS CURVE": "هێڵی پێشکەوتنی کۆنترۆڵکراو",
  "Project S-curve explorer": "گەڕانی هێڵی Sی پڕۆژە",
  "Project S-curve": "هێڵی Sی پڕۆژە",
  "Year": "ساڵ",
  "Month": "مانگ",
  "Week": "هەفتە",
  "Discipline": "دیسیپلین",
  "Sub-discipline": "ژێر دیسیپلین",
  "Displayed years": "ساڵە پیشاندراوەکان",
  "All years": "هەموو ساڵەکان",
  "Overall": "گشتی",
  "Overall total": "کۆی گشتی",
  "Engineering": "ئەندازیاری",
  "Procurement": "دابینکردن",
  "Construction": "بنیاتنان",
  "Mobilization": "مۆبڵایزەیشن",
  "Plant Design": "دیزاینی پلانت",
  "Architecture & Civil": "تەلارسازی و مەدەنی",
  "Electrical": "کارەبا",
  "I&C": "ئامێر و کۆنترۆڵ",
  "Process": "پرۆسێس",
  "Mechanical": "میکانیکی",
  "Key Equipment": "ئامێرە سەرەکییەکان",
  "Civil": "مەدەنی",
  "Instrumentation Control": "ئامێر و کۆنترۆڵ",
  "Earthworks": "کارەکانی خاک",
  "Civil Works": "کارە مەدەنییەکان",
  "Steel Erection": "هەڵکردنی ئاسن",
  "Architectural": "تەلارسازی",
  "Piping Works": "کارەکانی بۆری",
  "E&I Works": "کارەکانی E&I",
  "Mechanical Equipment": "ئامێری میکانیکی",
  "ST & GT Erection Works": "هەڵکردنی ST و GT",
  "H.V.A.C Works": "کارەکانی HVAC",
  "Fire Fighting Works": "کارەکانی ئاگرکوژێنەوە",
  "Heat Insulation Works": "کارەکانی عایقی گەرمی",
  "Painting & Coating Works": "بۆیە و کۆتینگ",
  "Start-Up": "دەستپێکردن",
  "Finish variance": "جیاوازی کۆتایی",
  "WORKBOOK STRUCTURE": "پێکهاتەی فایل",
  "All disciplines and sub-disciplines": "هەموو دیسیپلین و ژێر دیسیپلینەکان",
  "Frequency": "دووبارەبوونەوە",
  "Baseline at actual": "بنچینە لە بەرواری ڕاستەقینە",
  "Monthly": "مانگانە",
  "Weekly": "هەفتانە",
  "Cumulative · baseline controlled": "کەڵەکەبوو · بنچینەی کۆنترۆڵکراو",
  "DOCUMENT CONTROL": "کۆنترۆڵی بەڵگەنامە",
  "Controlled document register": "تۆماری بەڵگەنامە کۆنترۆڵکراوەکان",
  "Review performance, responsibility, aging and direct source-file access.": "ئەدا، بەرپرسیارێتی، تەمەن و دەستگەیشتنی ڕاستەوخۆ بە فایلە سەرچاوەکان بپشکنە.",
  "Download register": "داگرتنی تۆمار",
  "Total documents": "کۆی بەڵگەنامەکان",
  "Unique document numbers": "ژمارە بەڵگەنامە تایبەتەکان",
  "Approved": "پەسەندکراو",
  "Approved with comments": "پەسەندکراو لەگەڵ تێبینی",
  "Under review": "لەژێر پشکنین",
  "Revise & resubmit": "پێداچوونەوە و ناردنەوە",
  "DISTRIBUTION": "دابەشبوون",
  "Documents by discipline": "بەڵگەنامە بە پێی دیسیپلین",
  "WORKFLOW": "ڕەوتی کار",
  "Current responsibility": "بەرپرسیارێتی ئێستا",
  "LIVE REGISTER": "تۆماری چالاک",
  "List of documents": "لیستی بەڵگەنامەکان",
  "INTEGRATED SCHEDULE": "خشتەی کاتی یەکگرتوو",
  "Project plan and Gantt": "پلانی پڕۆژە و گانت",
  "WBS, disciplines, sub-disciplines, milestones, float, criticality and progress from the latest Excel schedule.": "WBS، دیسیپلین، ژێر دیسیپلین، مایلستۆن، فلۆت، گرنگی و پێشکەوتن لە نوێترین خشتەی Excel.",
  "Schedule rows": "ڕیزەکانی خشتە",
  "Activities": "چالاکییەکان",
  "Critical": "گرنگ",
  "Mapping warnings": "ئاگادارکردنەوەکانی نەخشەکردن",
  "Forecast finish": "کۆتایی پێشبینیکراو",
  "ACTIVITY STATUS": "دۆخی چالاکی",
  "Schedule distribution": "دابەشبوونی خشتە",
  "Import and validate project data": "هاوردەکردن و پشتڕاستکردنەوەی داتای پڕۆژە",
  "Upload controlled Excel updates, review the validation result, then publish one complete version.": "نوێکردنەوەکانی Excel باربکە، ئەنجامی پشتڕاستکردنەوە بپشکنە و پاشان وەشانێکی تەواو بڵاوبکەرەوە.",
  "Upload": "بارکردن",
  "Validate": "پشتڕاستکردنەوە",
  "Publish": "بڵاوکردنەوە",
  "Select controlled files": "فایلە کۆنترۆڵکراوەکان هەڵبژێرە",
  "Review mapping and warnings": "نەخشەکردن و ئاگادارکردنەوە بپشکنە",
  "Release to authorized users": "بۆ بەکارهێنەرانی ڕێپێدراو بڵاوی بکەرەوە",
  "Upload the controlled project workbooks": "فایلە Excelـە کۆنترۆڵکراوەکانی پڕۆژە باربکە",
  "Select Excel files": "فایلەکانی Excel هەڵبژێرە",
  "Upload status": "دۆخی بارکردن",
  "AUTOMATIC ANALYSIS": "شیکردنەوەی ئۆتۆماتیکی",
  "ACCESS CONTROL": "کۆنترۆڵی دەستگەیشتن",
  "Users and section permissions": "بەکارهێنەران و مۆڵەتەکانی بەش",
  "NEW ACCOUNT": "هەژماری نوێ",
  "Create user with temporary password": "دروستکردنی بەکارهێنەر بە وشەی نهێنی کاتی",
  "Full name": "ناوی تەواو",
  "Username": "ناوی بەکارهێنەر",
  "Email address": "ناونیشانی ئیمەیڵ",
  "Role": "ڕۆڵ",
  "Temporary password": "وشەی نهێنی کاتی",
  "Generate": "دروستکردن",
  "Copy": "کۆپی",
  "Section permissions": "مۆڵەتەکانی بەش",
  "No access": "بێ دەستگەیشتن",
  "View": "بینین",
  "Manage": "بەڕێوەبردن",
  "Create user account": "دروستکردنی هەژماری بەکارهێنەر",
  "AUTHORIZED USERS": "بەکارهێنەرانی ڕێپێدراو",
  "Active": "چالاک",
  "Disabled": "ناچالاک",
  "Last login": "دوا چوونەژوورەوە",
  "Save permissions": "پاشەکەوتکردنی مۆڵەتەکان",
  "Remove access": "لابردنی دەستگەیشتن",
  "AUDIT & GOVERNANCE": "پشکنین و حوکمڕانی",
  "User activity log": "تۆماری چالاکی بەکارهێنەر",
  "Baghdad time": "کاتی بەغدا",
  "LATEST EVENTS": "نوێترین ڕووداوەکان",
  "Most recent 200 activities": "نوێترین ٢٠٠ چالاکی",
  "Date and time": "بەروار و کات",
  "User": "بەکارهێنەر",
  "Activity": "چالاکی",
  "Details": "وردەکاری",
  "No recorded activities yet.": "هێشتا هیچ چالاکییەک تۆمار نەکراوە.",
  "SECURE PROJECT ACCESS": "دەستگەیشتنی پارێزراوی پڕۆژە",
  "Welcome back": "بەخێربێیتەوە",
  "Reset your password": "وشەی نهێنی نوێ بکەرەوە",
  "Enter your registered email address.": "ناونیشانی ئیمەیڵی تۆمارکراوت بنووسە.",
  "Sign in to access the latest controlled project information.": "بچۆ ژوورەوە بۆ دەستگەیشتن بە نوێترین زانیاری کۆنترۆڵکراوی پڕۆژە.",
  "Username or email": "ناوی بەکارهێنەر یان ئیمەیڵ",
  "Password": "وشەی نهێنی",
  "Please wait…": "تکایە چاوەڕێ بکە…",
  "Send reset link": "بەستەری نوێکردنەوە بنێرە",
  "Sign in securely": "بە پارێزراوی بچۆ ژوورەوە",
  "Return to sign in": "گەڕانەوە بۆ چوونەژوورەوە",
  "Forgot your password?": "وشەی نهێنیت لەبیرکردووە؟",
  "ONE CONTROLLED SOURCE OF TRUTH": "یەک سەرچاوەی کۆنترۆڵکراوی ڕاستی",
  "Turn every project update into a management decision.": "هەر نوێکردنەوەیەکی پڕۆژە بکە بە بڕیارێکی بەڕێوەبەرایەتی.",
  "Document control": "کۆنترۆڵی بەڵگەنامە",
  "Dynamic S-curves": "هێڵە S داینامیکییەکان",
  "Integrated schedule": "خشتەی کاتی یەکگرتوو",
  "SECURE • VERSIONED • AUDITABLE": "پارێزراو • وەشاندار • پشکنین‌پەسەند",
  "Authorized project personnel only": "تەنها ستافی ڕێپێدراوی پڕۆژە"
};

const ar: Record<string, string> = {
  "English": "الإنجليزية", "Kurdish Sorani": "الكردية السورانية", "Arabic": "العربية",
  "Taurus Project Control": "تاوروس للتحكم بالمشاريع", "CONTROLLED DATA PORTAL": "بوابة البيانات المنضبطة", "PROJECT ASSURANCE PLATFORM": "منصة ضمان المشروع",
  "PROJECT CONTROL": "التحكم بالمشروع", "ADMINISTRATION": "الإدارة", "Executive Overview": "النظرة التنفيذية", "Document Control": "ضبط الوثائق", "Progress & S-Curves": "التقدم ومنحنيات S", "Project Schedule": "الجدول الزمني للمشروع", "Import & Publish": "الاستيراد والنشر", "User Access": "صلاحيات المستخدمين", "Activity Log": "سجل النشاط",
  "ACTIVE PROJECT": "المشروع النشط", "Published data": "بيانات منشورة", "Awaiting first publish": "بانتظار أول نشر", "DATA DATE": "تاريخ البيانات", "PROGRESS DATA DATE": "تاريخ بيانات التقدم", "SCHEDULE DATA DATE": "تاريخ بيانات الجدول", "Data date": "تاريخ البيانات", "Not published": "غير منشور", "Sign out": "تسجيل الخروج",
  "EXECUTIVE CONTROL ROOM": "غرفة التحكم التنفيذية", "Project performance overview": "نظرة عامة على أداء المشروع", "Latest controlled progress, document status, and schedule position.": "أحدث تقدم منضبط وحالة الوثائق والموقف الزمني.", "Export briefing": "تصدير الموجز",
  "Actual progress": "التقدم الفعلي", "Baseline progress": "تقدم خط الأساس", "Earned to data date": "المتحقق حتى تاريخ البيانات", "Approved baseline at data date": "خط الأساس المعتمد عند تاريخ البيانات", "Schedule variance": "الانحراف الزمني", "Actual minus baseline": "الفعلي ناقص خط الأساس", "Expected finish": "الإنجاز المتوقع", "Baseline-performance forecast": "توقع مبني على أداء خط الأساس", "Controlled documents": "الوثائق المنضبطة", "Critical activities": "الأنشطة الحرجة",
  "PERFORMANCE CURVE": "منحنى الأداء", "Overall cumulative S-curve": "منحنى S التراكمي الكلي", "Baseline vs actual": "خط الأساس مقابل الفعلي", "CONTROL STATUS": "حالة التحكم", "Management signal": "مؤشر الإدارة", "SCHEDULE STATUS": "حالة الجدول", "Schedule status": "حالة الجدول", "Ahead of baseline": "متقدم على خط الأساس", "On baseline": "مطابق لخط الأساس", "Slightly behind baseline": "متأخر قليلاً عن خط الأساس", "Behind baseline": "متأخر عن خط الأساس", "Pending data": "بانتظار البيانات", "Total": "الإجمالي", "All": "الكل", "curves": "منحنيات", "Baseline position": "موضع خط الأساس", "Actual achieved": "الفعلي المتحقق", "Forecast variance": "انحراف التوقع", "Workbook structure recognized": "تم التعرف على هيكل المصنف",
  "DOCUMENT REGISTER": "سجل الوثائق", "Distribution by discipline": "التوزيع حسب التخصص", "RESPONSIBILITY": "المسؤولية", "Current document action": "إجراء الوثيقة الحالي",
  "PROGRESS ANALYTICS": "تحليلات التقدم", "Monthly and weekly performance": "الأداء الشهري والأسبوعي", "Approved baseline and actual cumulative achievement with schedule forecast controls.": "خط الأساس المعتمد والإنجاز الفعلي التراكمي مع ضوابط توقع الجدول.", "Year · month · week": "سنة · شهر · أسبوع", "Actual": "الفعلي", "Baseline": "خط الأساس", "Approved baseline": "خط الأساس المعتمد", "Actual cumulative": "الفعلي التراكمي", "Cumulative progress": "التقدم التراكمي", "At current data date": "عند تاريخ البيانات الحالي", "Expected completion from baseline duration ÷ SPI": "الإنجاز المتوقع من مدة خط الأساس ÷ SPI",
  "FORECAST METHOD": "طريقة التوقع", "Baseline performance forecast": "توقع أداء خط الأساس", "Expected finish uses approved baseline duration divided by the same-date SPI. No current-plan values are used.": "يستخدم الإنجاز المتوقع مدة خط الأساس المعتمدة مقسومة على SPI للتاريخ نفسه. ولا تُستخدم قيم الخطة الحالية.", "STATUS THRESHOLDS": "حدود الحالة", "Controlled schedule signal": "إشارة الجدول المنضبط", "Ahead > 1.01": "متقدم > 1.01", "On baseline 0.99–1.01": "على خط الأساس 0.99–1.01", "Slight delay 0.96–0.99": "تأخر طفيف 0.96–0.99", "Delayed < 0.96": "متأخر < 0.96",
  "CONTROLLED PROGRESS CURVE": "منحنى التقدم المنضبط", "Project S-curve explorer": "مستكشف منحنى S للمشروع", "Project S-curve": "منحنى S للمشروع", "Year": "سنة", "Month": "شهر", "Week": "أسبوع", "Discipline": "التخصص", "Sub-discipline": "التخصص الفرعي", "Displayed years": "السنوات المعروضة", "All years": "كل السنوات", "Overall": "الإجمالي", "Overall total": "الإجمالي الكلي", "Engineering": "الهندسة", "Procurement": "المشتريات", "Construction": "الإنشاءات", "Mobilization": "التعبئة",
  "Plant Design": "تصميم المحطة", "Architecture & Civil": "المعماري والمدني", "Electrical": "الكهرباء", "I&C": "الأجهزة والتحكم", "Process": "العمليات", "Mechanical": "الميكانيك", "Key Equipment": "المعدات الرئيسية", "Civil": "المدني", "Instrumentation Control": "الأجهزة والتحكم", "Earthworks": "الأعمال الترابية", "Civil Works": "الأعمال المدنية", "Steel Erection": "تركيب الفولاذ", "Architectural": "المعماري", "Piping Works": "أعمال الأنابيب", "E&I Works": "أعمال الكهرباء والأجهزة", "Mechanical Equipment": "المعدات الميكانيكية", "ST & GT Erection Works": "تركيب التوربينات البخارية والغازية", "H.V.A.C Works": "أعمال التكييف", "Fire Fighting Works": "أعمال مكافحة الحريق", "Heat Insulation Works": "أعمال العزل الحراري", "Painting & Coating Works": "أعمال الطلاء والتغليف", "Start-Up": "بدء التشغيل",
  "Finish variance": "انحراف الإنجاز", "WORKBOOK STRUCTURE": "هيكل المصنف", "All disciplines and sub-disciplines": "جميع التخصصات والتخصصات الفرعية", "Frequency": "التكرار", "Baseline at actual": "خط الأساس عند الفعلي", "Monthly": "شهري", "Weekly": "أسبوعي", "Cumulative · baseline controlled": "تراكمي · خط أساس منضبط",
  "DOCUMENT CONTROL": "ضبط الوثائق", "Controlled document register": "سجل الوثائق المنضبط", "Review performance, responsibility, aging and direct source-file access.": "مراجعة الأداء والمسؤولية والتقادم والوصول المباشر إلى الملفات المصدرية.", "Download register": "تنزيل السجل", "Total documents": "إجمالي الوثائق", "Unique document numbers": "أرقام وثائق فريدة", "Approved": "معتمد", "Approved with comments": "معتمد مع ملاحظات", "Under review": "قيد المراجعة", "Revise & resubmit": "تعديل وإعادة تقديم", "DISTRIBUTION": "التوزيع", "Documents by discipline": "الوثائق حسب التخصص", "WORKFLOW": "سير العمل", "Current responsibility": "المسؤولية الحالية", "LIVE REGISTER": "السجل المباشر", "List of documents": "قائمة الوثائق",
  "INTEGRATED SCHEDULE": "الجدول المتكامل", "Project plan and Gantt": "خطة المشروع ومخطط غانت", "Schedule rows": "صفوف الجدول", "Activities": "الأنشطة", "Critical": "حرج", "Mapping warnings": "تحذيرات المطابقة", "Forecast finish": "الإنجاز المتوقع", "ACTIVITY STATUS": "حالة النشاط", "Schedule distribution": "توزيع الجدول",
  "Import and validate project data": "استيراد بيانات المشروع والتحقق منها", "Upload controlled Excel updates, review the validation result, then publish one complete version.": "ارفع تحديثات Excel المنضبطة، وراجع نتيجة التحقق، ثم انشر نسخة كاملة.", "Upload": "رفع", "Validate": "تحقق", "Publish": "نشر", "Select controlled files": "اختر الملفات المنضبطة", "Review mapping and warnings": "راجع المطابقة والتحذيرات", "Release to authorized users": "إصدار للمستخدمين المخولين", "Upload the controlled project workbooks": "ارفع مصنفات المشروع المنضبطة", "Select Excel files": "اختر ملفات Excel", "Upload status": "حالة الرفع", "AUTOMATIC ANALYSIS": "التحليل التلقائي",
  "ACCESS CONTROL": "التحكم بالوصول", "Users and section permissions": "المستخدمون وصلاحيات الأقسام", "NEW ACCOUNT": "حساب جديد", "Create user with temporary password": "إنشاء مستخدم بكلمة مرور مؤقتة", "Full name": "الاسم الكامل", "Username": "اسم المستخدم", "Email address": "البريد الإلكتروني", "Role": "الدور", "Temporary password": "كلمة مرور مؤقتة", "Generate": "إنشاء", "Copy": "نسخ", "Section permissions": "صلاحيات الأقسام", "No access": "لا وصول", "View": "عرض", "Manage": "إدارة", "Create user account": "إنشاء حساب مستخدم", "AUTHORIZED USERS": "المستخدمون المخولون", "Active": "نشط", "Disabled": "معطل", "Last login": "آخر تسجيل دخول", "Save permissions": "حفظ الصلاحيات", "Remove access": "إزالة الوصول",
  "AUDIT & GOVERNANCE": "التدقيق والحوكمة", "User activity log": "سجل نشاط المستخدم", "Baghdad time": "توقيت بغداد", "LATEST EVENTS": "أحدث الأحداث", "Most recent 200 activities": "آخر 200 نشاط", "Date and time": "التاريخ والوقت", "User": "المستخدم", "Activity": "النشاط", "Details": "التفاصيل", "No recorded activities yet.": "لا توجد أنشطة مسجلة بعد.",
  "SECURE PROJECT ACCESS": "وصول آمن للمشروع", "Welcome back": "مرحباً بعودتك", "Reset your password": "إعادة تعيين كلمة المرور", "Enter your registered email address.": "أدخل بريدك الإلكتروني المسجل.", "Sign in to access the latest controlled project information.": "سجل الدخول للوصول إلى أحدث معلومات المشروع المنضبطة.", "Username or email": "اسم المستخدم أو البريد الإلكتروني", "Password": "كلمة المرور", "Please wait…": "يرجى الانتظار…", "Send reset link": "إرسال رابط إعادة التعيين", "Sign in securely": "تسجيل دخول آمن", "Return to sign in": "العودة لتسجيل الدخول", "Forgot your password?": "هل نسيت كلمة المرور؟", "ONE CONTROLLED SOURCE OF TRUTH": "مصدر واحد منضبط للحقيقة", "Turn every project update into a management decision.": "حوّل كل تحديث للمشروع إلى قرار إداري.", "Document control": "ضبط الوثائق", "Dynamic S-curves": "منحنيات S ديناميكية", "Integrated schedule": "جدول متكامل", "SECURE • VERSIONED • AUDITABLE": "آمن • بإصدارات • قابل للتدقيق", "Authorized project personnel only": "لموظفي المشروع المخولين فقط"
};

Object.assign(ku, {
  "Dark mode": "دۆخی تاریک",
  "Light mode": "دۆخی ڕووناک",
  "Switch to dark mode": "گۆڕین بۆ دۆخی تاریک",
  "Switch to light mode": "گۆڕین بۆ دۆخی ڕووناک",
  "EXECUTIVE PROGRESS CONTROL": "کۆنترۆڵی پێشکەوتنی بەڕێوەبەرایەتی",
  "Discipline performance and forecast": "ئەدا و پێشبینی بە پێی دیسیپلین",
  "Selected curve": "هێڵی هەڵبژێردراو",
  "Monthly cumulative reporting": "ڕاپۆرتی مانگانەی کەڵەکەبوو",
  "Weekly cumulative reporting": "ڕاپۆرتی هەفتانەی کەڵەکەبوو",
  "COMPLETE": "تەواو",
  "No cumulative curve is available for this selection.": "هیچ هێڵێکی کەڵەکەبوو بۆ ئەم هەڵبژاردنە بەردەست نییە.",
  "Confirm that the matching worksheet is present in the uploaded workbook.": "دڵنیابە کە شیتی هاوتا لە فایلی بارکراودا هەیە.",
  "final approved": "پەسەندکراوی کۆتایی",
  "activities": "چالاکی",
  "controlled progress curves": "هێڵی پێشکەوتنی کۆنترۆڵکراو",
  "Pending": "چاوەڕێ",
  "Scroll horizontally to view every reporting period": "بە ئاسۆیی بگوازەرەوە بۆ بینینی هەموو ماوەکانی ڕاپۆرت",
  "All reporting periods are labelled": "هەموو ماوەکانی ڕاپۆرت ناونیشانکراون",
  "PROGRAMME VIEW": "دیمەنی بەرنامە",
  "Discipline-level Gantt": "گانت بە پێی دیسیپلین",
  "FULL PROJECT PLAN": "پلانی تەواوی پڕۆژە",
  "All schedule activities": "هەموو چالاکییەکانی خشتەی کات",
  "rows": "ڕیز",
  "All disciplines": "هەموو دیسیپلینەکان",
  "All sub-disciplines": "هەموو ژێر دیسیپلینەکان",
  "Status": "دۆخ",
  "All statuses": "هەموو دۆخەکان",
  "Search": "گەڕان",
  "Activity ID or name": "ناسنامە یان ناوی چالاکی",
  "Critical only": "تەنها گرنگەکان",
  "Activity ID": "ناسنامەی چالاکی",
  "Activity name": "ناوی چالاکی",
  "Start": "دەستپێک",
  "Finish": "کۆتایی",
  "Schedule": "خشتەی کات",
  "Performance": "ئەدا",
  "Total float": "فلۆتی گشتی",
  "Yes": "بەڵێ",
  "No": "نەخێر",
  "No activities match these filters.": "هیچ چالاکییەک لەگەڵ ئەم فلتەرانە ناگونجێت.",
  "Page": "پەڕە",
  "of": "لە",
  "Previous": "پێشوو",
  "Next": "دواتر",
  "No published schedule": "هیچ خشتەی کاتێک بڵاونەکراوەتەوە",
  "Upload the schedule workbook from Import & Publish. The activity plan will then appear here automatically.": "فایلی خشتەی کات لە بەشی هاوردەکردن و بڵاوکردنەوە باربکە؛ پلانی چالاکی بە شێوەی ئۆتۆماتیکی لێرە دەردەکەوێت.",
  "Search document number, title, discipline or sub-discipline": "بە ژمارە، ناونیشان، دیسیپلین یان ژێر دیسیپلین بگەڕێ",
  "Document No.": "ژمارەی بەڵگەنامە",
  "Title": "ناونیشان",
  "Rev.": "پێداچوونەوە",
  "Action": "کردەوە",
  "Overdue": "دواکەوتوو",
  "File": "فایل",
  "Open file": "کردنەوەی فایل",
  "documents": "بەڵگەنامە",
  "No published MDR yet": "هێشتا MDR بڵاونەکراوەتەوە",
  "Use Import & Publish to upload the progress/MDR workbook.": "بەشی هاوردەکردن و بڵاوکردنەوە بەکاربهێنە بۆ بارکردنی فایلی پێشکەوتن/MDR.",
  "Choose the progress/MDR workbook, schedule export, or both. Analysis and publication start automatically.": "فایلی پێشکەوتن/MDR، خشتەی کات، یان هەردووکیان هەڵبژێرە. شیکردنەوە و بڵاوکردنەوە ئۆتۆماتیکی دەستپێدەکات.",
  "XLSX only, maximum 8 MB per file. Uploading one file keeps the other published analysis.": "تەنها XLSX، بۆ هەر فایلێک زۆرترین ٨ MB. بارکردنی یەک فایل شیکردنەوەی بڵاوکراوی فایلەکەی تر دەپارێزێت.",
  "Select an XLSX workbook.": "فایلێکی XLSX هەڵبژێرە.",
  "Select a maximum of two workbooks: one progress/MDR file and one schedule file.": "زۆرترین دوو فایل هەڵبژێرە: یەک فایل پێشکەوتن/MDR و یەک فایل خشتەی کات.",
  "Update analyzed and published successfully. All authorized users will see the new data.": "نوێکردنەوەکە بە سەرکەوتوویی شیکرایەوە و بڵاوکرایەوە. هەموو بەکارهێنەرانی ڕێپێدراو داتای نوێ دەبینن.",
  "Reading": "خوێندنەوە",
  "Failed": "شکستی هێنا",
  "Ready": "ئامادە",
  "Review": "پشکنین",
  "Progress & MDR": "پێشکەوتن و MDR",
  "Schedule export": "هەناردەی خشتەی کات",
  "Blocking errors": "هەڵە ڕێگرەکان",
  "Review notes": "تێبینییەکانی پشکنین",
  "Validation passed": "پشتڕاستکردنەوە سەرکەوتوو بوو",
  "Resolve the blocking errors": "هەڵە ڕێگرەکان چارەسەر بکە",
  "The valid workbook has been analyzed and published.": "فایلە دروستەکە شیکراوەتەوە و بڵاوکراوەتەوە.",
  "Live": "چالاک",
  "If the account exists, a secure reset link has been sent.": "ئەگەر هەژمارەکە هەبێت، بەستەرێکی پارێزراوی نوێکردنەوە نێردراوە.",
  "The request could not be completed.": "داواکارییەکە تەواو نەکرا.",
  "your.username": "ناوی.بەکارهێنەر",
  "ACCOUNT SECURITY": "پاراستنی هەژمار",
  "Create a new password": "وشەی نهێنی نوێ دروست بکە",
  "Use a strong password that is unique to this portal.": "وشەی نهێنی بەهێز و تایبەت بە ئەم پۆرتاڵە بەکاربهێنە.",
  "New password": "وشەی نهێنی نوێ",
  "Update password": "نوێکردنەوەی وشەی نهێنی",
  "Updating…": "نوێکردنەوە…",
  "Use 12+ characters with uppercase, lowercase, a number and a symbol.": "١٢ پیت یان زیاتر لەگەڵ پیتی گەورە، بچووک، ژمارە و هێما بەکاربهێنە.",
  "Forced password change": "گۆڕینی ناچاری وشەی نهێنی",
  "Viewer": "بینەر",
  "Planner": "پلانەر",
  "Document Controller": "کۆنترۆڵکاری بەڵگەنامە",
  "Project Administrator": "بەڕێوەبەری پڕۆژە",
  "Super Administrator": "بەڕێوەبەری باڵا",
  "Employee name": "ناوی کارمەند",
  "Generate or enter 12+ characters": "دروستی بکە یان ١٢ پیت یان زیاتر بنووسە",
  "Choose no access, view, or manage for every part of the portal.": "بۆ هەر بەشێکی پۆرتاڵ بێ دەستگەیشتن، بینین یان بەڕێوەبردن هەڵبژێرە.",
  "Temporary password created": "وشەی نهێنی کاتی دروستکرا",
  "Share it securely. The user must replace it at first login.": "بە شێوەی پارێزراو هاوبەشی بکە. بەکارهێنەر دەبێت لە یەکەم چوونەژوورەوە بیگۆڕێت.",
  "Copy password": "کۆپی وشەی نهێنی",
  "Creating account…": "دروستکردنی هەژمار…",
  "Never": "هەرگیز",
  "permission": "مۆڵەت",
  "Temporary password change is pending.": "گۆڕینی وشەی نهێنی کاتی چاوەڕێیە.",
  "Password is controlled by the user.": "وشەی نهێنی لەلایەن بەکارهێنەرەوە کۆنترۆڵ دەکرێت.",
  "Issue a new temporary password (optional)": "وشەی نهێنی کاتی نوێ بدە (ئارەزوومەندانە)",
  "Leave blank to keep current password": "بە بەتاڵی جێبهێڵە بۆ پاراستنی وشەی ئێستا",
  "Saving…": "پاشەکەوتکردن…",
  "View only": "تەنها بینین",
  "account": "هەژمار",
  "accounts": "هەژمار",
  "Project KPIs and management summary": "KPIی پڕۆژە و پوختەی بەڕێوەبەرایەتی",
  "MDR, status, overdue data and links": "MDR، دۆخ، داتای دواکەوتوو و بەستەرەکان",
  "Monthly, weekly and discipline progress": "پێشکەوتنی مانگانە، هەفتانە و دیسیپلین",
  "WBS, Gantt, milestones and criticality": "WBS، گانت، مایلستۆن و گرنگی",
  "Upload, validate and publish controlled updates": "بارکردن، پشتڕاستکردنەوە و بڵاوکردنەوەی نوێکردنەوە کۆنترۆڵکراوەکان",
  "Create, edit and remove user accounts": "دروستکردن، دەستکاری و لابردنی هەژمارەکان",
  "Review logins, page access and administration": "پشکنینی چوونەژوورەوە، دەستگەیشتنی پەڕە و بەڕێوەبەرایەتی"
});

Object.assign(ar, {
  "Dark mode": "الوضع الداكن",
  "Light mode": "الوضع الفاتح",
  "Switch to dark mode": "التبديل إلى الوضع الداكن",
  "Switch to light mode": "التبديل إلى الوضع الفاتح",
  "EXECUTIVE PROGRESS CONTROL": "التحكم التنفيذي بالتقدم",
  "Discipline performance and forecast": "الأداء والتوقع حسب التخصص",
  "Selected curve": "المنحنى المحدد",
  "Monthly cumulative reporting": "التقرير التراكمي الشهري",
  "Weekly cumulative reporting": "التقرير التراكمي الأسبوعي",
  "COMPLETE": "مكتمل",
  "No cumulative curve is available for this selection.": "لا يتوفر منحنى تراكمي لهذا الاختيار.",
  "Confirm that the matching worksheet is present in the uploaded workbook.": "تأكد من وجود ورقة العمل المطابقة في المصنف المرفوع.",
  "final approved": "معتمد نهائياً",
  "activities": "أنشطة",
  "controlled progress curves": "منحنيات تقدم منضبطة",
  "Pending": "قيد الانتظار",
  "Scroll horizontally to view every reporting period": "مرّر أفقياً لعرض جميع فترات التقرير",
  "All reporting periods are labelled": "جميع فترات التقرير ظاهرة على المحور",
  "PROGRAMME VIEW": "عرض البرنامج", "Discipline-level Gantt": "مخطط غانت حسب التخصص", "FULL PROJECT PLAN": "خطة المشروع الكاملة", "All schedule activities": "جميع أنشطة الجدول", "rows": "صفوف",
  "All disciplines": "جميع التخصصات", "All sub-disciplines": "جميع التخصصات الفرعية", "Status": "الحالة", "All statuses": "جميع الحالات", "Search": "بحث", "Activity ID or name": "معرف النشاط أو اسمه", "Critical only": "الحرجة فقط",
  "Activity ID": "معرف النشاط", "Activity name": "اسم النشاط", "Start": "البدء", "Finish": "الإنجاز", "Schedule": "الجدول", "Performance": "الأداء", "Total float": "السماح الكلي", "Yes": "نعم", "No": "لا", "No activities match these filters.": "لا توجد أنشطة تطابق هذه المرشحات.", "Page": "صفحة", "of": "من", "Previous": "السابق", "Next": "التالي",
  "No published schedule": "لا يوجد جدول منشور", "Upload the schedule workbook from Import & Publish. The activity plan will then appear here automatically.": "ارفع مصنف الجدول من الاستيراد والنشر، وستظهر خطة الأنشطة هنا تلقائياً.",
  "Search document number, title, discipline or sub-discipline": "ابحث برقم الوثيقة أو العنوان أو التخصص أو التخصص الفرعي", "Document No.": "رقم الوثيقة", "Title": "العنوان", "Rev.": "المراجعة", "Action": "الإجراء", "Overdue": "متأخر", "File": "الملف", "Open file": "فتح الملف", "documents": "وثائق", "No published MDR yet": "لم يُنشر سجل MDR بعد", "Use Import & Publish to upload the progress/MDR workbook.": "استخدم الاستيراد والنشر لرفع مصنف التقدم/MDR.",
  "Choose the progress/MDR workbook, schedule export, or both. Analysis and publication start automatically.": "اختر مصنف التقدم/MDR أو تصدير الجدول أو كليهما. يبدأ التحليل والنشر تلقائياً.", "XLSX only, maximum 8 MB per file. Uploading one file keeps the other published analysis.": "ملفات XLSX فقط، بحد أقصى 8 ميغابايت لكل ملف. رفع ملف واحد يبقي تحليل الملف الآخر منشوراً.", "Select an XLSX workbook.": "اختر مصنف XLSX.", "Select a maximum of two workbooks: one progress/MDR file and one schedule file.": "اختر مصنفين كحد أقصى: ملف تقدم/MDR وملف جدول.", "Update analyzed and published successfully. All authorized users will see the new data.": "تم تحليل التحديث ونشره بنجاح. سيرى جميع المستخدمين المخولين البيانات الجديدة.",
  "Reading": "جارٍ القراءة", "Failed": "فشل", "Ready": "جاهز", "Review": "مراجعة", "Progress & MDR": "التقدم وMDR", "Schedule export": "تصدير الجدول", "Blocking errors": "أخطاء مانعة", "Review notes": "ملاحظات المراجعة", "Validation passed": "نجح التحقق", "Resolve the blocking errors": "عالج الأخطاء المانعة", "The valid workbook has been analyzed and published.": "تم تحليل المصنف الصحيح ونشره.", "Live": "مباشر",
  "If the account exists, a secure reset link has been sent.": "إذا كان الحساب موجوداً، فقد أُرسل رابط آمن لإعادة التعيين.", "The request could not be completed.": "تعذر إكمال الطلب.", "your.username": "اسم.المستخدم", "ACCOUNT SECURITY": "أمان الحساب", "Create a new password": "إنشاء كلمة مرور جديدة", "Use a strong password that is unique to this portal.": "استخدم كلمة مرور قوية ومخصصة لهذه البوابة.", "New password": "كلمة المرور الجديدة", "Update password": "تحديث كلمة المرور", "Updating…": "جارٍ التحديث…", "Use 12+ characters with uppercase, lowercase, a number and a symbol.": "استخدم 12 حرفاً أو أكثر تتضمن حرفاً كبيراً وصغيراً ورقماً ورمزاً.",
  "Forced password change": "تغيير إلزامي لكلمة المرور", "Viewer": "مشاهد", "Planner": "مخطط", "Document Controller": "مراقب وثائق", "Project Administrator": "مدير المشروع", "Super Administrator": "المدير الأعلى", "Employee name": "اسم الموظف", "Generate or enter 12+ characters": "أنشئ أو أدخل 12 حرفاً أو أكثر", "Choose no access, view, or manage for every part of the portal.": "اختر عدم الوصول أو العرض أو الإدارة لكل جزء من البوابة.", "Temporary password created": "تم إنشاء كلمة مرور مؤقتة", "Share it securely. The user must replace it at first login.": "شاركها بأمان. يجب على المستخدم استبدالها عند أول تسجيل دخول.", "Copy password": "نسخ كلمة المرور", "Creating account…": "جارٍ إنشاء الحساب…", "Never": "أبداً", "permission": "صلاحية", "Temporary password change is pending.": "تغيير كلمة المرور المؤقتة قيد الانتظار.", "Password is controlled by the user.": "يتحكم المستخدم بكلمة المرور.", "Issue a new temporary password (optional)": "إصدار كلمة مرور مؤقتة جديدة (اختياري)", "Leave blank to keep current password": "اتركه فارغاً للإبقاء على كلمة المرور الحالية", "Saving…": "جارٍ الحفظ…", "View only": "عرض فقط", "account": "حساب", "accounts": "حسابات",
  "Project KPIs and management summary": "مؤشرات أداء المشروع والملخص الإداري", "MDR, status, overdue data and links": "سجل MDR والحالة والتأخيرات والروابط", "Monthly, weekly and discipline progress": "التقدم الشهري والأسبوعي وحسب التخصص", "WBS, Gantt, milestones and criticality": "هيكل WBS وغانت والمعالم والحرجية", "Upload, validate and publish controlled updates": "رفع التحديثات المنضبطة والتحقق منها ونشرها", "Create, edit and remove user accounts": "إنشاء حسابات المستخدمين وتعديلها وإزالتها", "Review logins, page access and administration": "مراجعة تسجيلات الدخول والوصول والإدارة"
});

Object.assign(ku, {
  "Document Control Command Center": "سەنتەری فەرماندەیی کۆنترۆڵی بەڵگەنامە",
  "14-day review control, responsibility, overdue aging and direct source-file access.": "کۆنترۆڵی پێداچوونەوەی ١٤ ڕۆژ، بەرپرسیارێتی، تەمەنی دواکەوتن و دەستگەیشتنی ڕاستەوخۆ بە فایل.",
  "Document filters": "فلتەرەکانی بەڵگەنامە", "Search all document fields": "گەڕان لە هەموو خانەکانی بەڵگەنامە", "Search by any document field, date, status or responsibility": "گەڕان بە هەر خانە، بەروار، دۆخ یان بەرپرسیارێتییەک", "Search": "گەڕان",
  "Responsible": "بەرپرسیار", "Review stage": "قۆناغی پێداچوونەوە", "Due from": "کاتی دیاریکراو لە", "Due to": "کاتی دیاریکراو تا", "Reset": "ڕێکخستنەوە", "Export": "هەناردەکردن",
  "Register": "تۆمار", "of register": "لە تۆمار", "disciplines": "دیسیپلین", "Due next 7 days": "لە ٧ ڕۆژی داهاتوودا", "Active contractual actions": "کردەوە گرێبەستییە چالاکەکان", "Avg. review cycle": "تێکڕای سوڕی پێداچوونەوە", "days": "ڕۆژ", "14-day target": "ئامانجی ١٤ ڕۆژ", "No completed cycle": "هیچ سوڕێکی تەواو نییە",
  "DOCUMENT STATUS": "دۆخی بەڵگەنامە", "Register status": "دۆخی تۆمار", "Other": "هیتر", "REVIEW PERFORMANCE": "ئەدای پێداچوونەوە", "Last 12 weeks": "دوا ١٢ هەفتە", "calendar days": "ڕۆژی ڕۆژژمێری", "ENKA submissions": "پێشکەشکردنەکانی ENKA", "Taurus responses": "وەڵامەکانی Taurus", "Review performance over the last 12 weeks": "ئەدای پێداچوونەوە لە دوا ١٢ هەفتە",
  "PRIORITY ACTIONS": "کردەوە پێشینەکان", "Immediate control actions": "کردەوە کۆنترۆڵییە دەستبەجێکان", "overdue documents": "بەڵگەنامەی دواکەوتوو", "Oldest overdue": "کۆنترین دواکەوتن", "actions due in 7 days": "کردەوە لە ٧ ڕۆژدا", "Taurus and ENKA contractual clocks": "کاتی گرێبەستی Taurus و ENKA", "ENKA responses due or overdue": "وەڵامەکانی ENKA کە کاتیان هاتووە یان دواکەوتوون", "Comment incorporation control": "کۆنترۆڵی جێبەجێکردنی تێبینی",
  "OVERDUE AGING": "تەمەنی دواکەوتن", "Aging by discipline": "تەمەن بە پێی دیسیپلین", "No overdue documents in the selected view.": "هیچ بەڵگەنامەیەکی دواکەوتوو لەم بینینەدا نییە.", "DISCIPLINE HEALTH": "تەندروستی دیسیپلین", "Review control by discipline": "کۆنترۆڵی پێداچوونەوە بە دیسیپلین", "Health": "تەندروستی", "Good": "باش", "Attention": "پێویستی بە سەرنج", "At risk": "لە مەترسیدا",
  "Controlled MDR documents": "بەڵگەنامە کۆنترۆڵکراوەکانی MDR", "Responsible / overdue by": "بەرپرسیار / دواکەوتوو لەلایەن", "Contractual due date": "بەرواری گرێبەستی", "Aging": "تەمەن", "Taurus review": "پێداچوونەوەی Taurus", "ENKA incorporation": "جێبەجێکردنی ENKA", "Final document": "بەڵگەنامەی کۆتایی", "On hold": "ڕاگیراو", "Unassigned": "دیارینەکراو", "Closed": "داخراو", "On Hold": "ڕاگیراو",
  "ENKA submission + 14 days": "پێشکەشکردنی ENKA + ١٤ ڕۆژ", "Taurus response + 14 days": "وەڵامی Taurus + ١٤ ڕۆژ", "days overdue": "ڕۆژ دواکەوتوو", "days remaining": "ڕۆژ ماوە", "Open": "کردنەوە", "No documents match these filters.": "هیچ بەڵگەنامەیەک لەگەڵ ئەم فلتەرانە ناگونجێت.", "Showing": "پیشاندانی", "Contract clocks current to": "کاتی گرێبەست نوێکراوەتەوە تا", "MDR data date": "بەرواری داتای MDR"
});

Object.assign(ar, {
  "Document Control Command Center": "مركز قيادة ضبط الوثائق",
  "14-day review control, responsibility, overdue aging and direct source-file access.": "رقابة مراجعة لمدة 14 يوماً، وتحديد المسؤولية، وأعمار التأخير، والوصول المباشر إلى الملفات المصدرية.",
  "Document filters": "مرشحات الوثائق", "Search all document fields": "البحث في جميع حقول الوثيقة", "Search by any document field, date, status or responsibility": "ابحث بأي حقل أو تاريخ أو حالة أو مسؤولية", "Search": "بحث",
  "Responsible": "المسؤول", "Review stage": "مرحلة المراجعة", "Due from": "الاستحقاق من", "Due to": "الاستحقاق إلى", "Reset": "إعادة ضبط", "Export": "تصدير",
  "Register": "السجل", "of register": "من السجل", "disciplines": "تخصصات", "Due next 7 days": "مستحق خلال 7 أيام", "Active contractual actions": "إجراءات تعاقدية نشطة", "Avg. review cycle": "متوسط دورة المراجعة", "days": "أيام", "14-day target": "هدف 14 يوماً", "No completed cycle": "لا توجد دورة مكتملة",
  "DOCUMENT STATUS": "حالة الوثائق", "Register status": "حالة السجل", "Other": "أخرى", "REVIEW PERFORMANCE": "أداء المراجعة", "Last 12 weeks": "آخر 12 أسبوعاً", "calendar days": "يوماً تقويمياً", "ENKA submissions": "تقديمات ENKA", "Taurus responses": "ردود Taurus", "Review performance over the last 12 weeks": "أداء المراجعة خلال آخر 12 أسبوعاً",
  "PRIORITY ACTIONS": "الإجراءات ذات الأولوية", "Immediate control actions": "إجراءات الرقابة الفورية", "overdue documents": "وثائق متأخرة", "Oldest overdue": "أقدم تأخير", "actions due in 7 days": "إجراءات مستحقة خلال 7 أيام", "Taurus and ENKA contractual clocks": "المدد التعاقدية لـ Taurus وENKA", "ENKA responses due or overdue": "ردود ENKA المستحقة أو المتأخرة", "Comment incorporation control": "رقابة إدراج الملاحظات",
  "OVERDUE AGING": "أعمار التأخير", "Aging by discipline": "التقادم حسب التخصص", "No overdue documents in the selected view.": "لا توجد وثائق متأخرة في العرض المحدد.", "DISCIPLINE HEALTH": "سلامة التخصص", "Review control by discipline": "رقابة المراجعة حسب التخصص", "Health": "المؤشر", "Good": "جيد", "Attention": "يحتاج انتباهاً", "At risk": "معرض للخطر",
  "Controlled MDR documents": "وثائق MDR المنضبطة", "Responsible / overdue by": "المسؤول / جهة التأخير", "Contractual due date": "تاريخ الاستحقاق التعاقدي", "Aging": "العمر", "Taurus review": "مراجعة Taurus", "ENKA incorporation": "إدراج ENKA", "Final document": "وثيقة نهائية", "On hold": "معلق", "Unassigned": "غير معين", "Closed": "مغلق", "On Hold": "معلق",
  "ENKA submission + 14 days": "تقديم ENKA + 14 يوماً", "Taurus response + 14 days": "رد Taurus + 14 يوماً", "days overdue": "أيام تأخير", "days remaining": "أيام متبقية", "Open": "فتح", "No documents match these filters.": "لا توجد وثائق مطابقة لهذه المرشحات.", "Showing": "عرض", "Contract clocks current to": "المدد التعاقدية محسوبة حتى", "MDR data date": "تاريخ بيانات MDR"
});

Object.assign(ku, {
  "CONTROLLED COMMUNICATION": "پەیوەندیی کۆنترۆڵکراو",
  "Notify project users of this update": "بەکارهێنەرانی پڕۆژە لەم نوێکردنەوەیە ئاگادار بکەرەوە",
  "Send a formal email to every other active project user with the dashboard link, administrator name and current schedule data date.": "ئیمەیڵێکی فەرمی بۆ هەموو بەکارهێنەرانی چالاکی تری پڕۆژە بنێرە کە بەستەری داشبۆرد، ناوی بەڕێوەبەر و بەرواری داتای ئێستای خشتەی کات لەخۆبگرێت.",
  "Published schedule data date": "بەرواری داتای خشتەی کاتی بڵاوکراو",
  "Sending notifications…": "ناردنی ئاگادارکردنەوەکان…",
  "Email update notification": "ناردنی ئاگادارکردنەوەی نوێکردنەوە بە ئیمەیڵ",
  "Send this update notification to every other active project user?": "ئەم ئاگادارکردنەوەی نوێکردنەوەیە بۆ هەموو بەکارهێنەرانی چالاکی تری پڕۆژە بنێردرێت؟",
  "Email notifications could not be sent.": "ئاگادارکردنەوەکانی ئیمەیڵ نەنێردران.",
  "There are no other active project users to notify.": "هیچ بەکارهێنەرێکی چالاکی تری پڕۆژە نییە بۆ ئاگادارکردنەوە.",
  "notifications sent": "ئاگادارکردنەوە نێردرا",
  "could not be delivered": "نەگەیشت",
  "project user(s) notified successfully": "بەکارهێنەری پڕۆژە بە سەرکەوتوویی ئاگادارکرایەوە"
});

Object.assign(ar, {
  "CONTROLLED COMMUNICATION": "اتصال منضبط",
  "Notify project users of this update": "إشعار مستخدمي المشروع بهذا التحديث",
  "Send a formal email to every other active project user with the dashboard link, administrator name and current schedule data date.": "إرسال بريد إلكتروني رسمي إلى جميع مستخدمي المشروع النشطين الآخرين يتضمن رابط لوحة المعلومات واسم المسؤول وتاريخ بيانات الجدول الحالي.",
  "Published schedule data date": "تاريخ بيانات الجدول المنشور",
  "Sending notifications…": "جارٍ إرسال الإشعارات…",
  "Email update notification": "إرسال إشعار التحديث بالبريد الإلكتروني",
  "Send this update notification to every other active project user?": "هل تريد إرسال إشعار التحديث هذا إلى جميع مستخدمي المشروع النشطين الآخرين؟",
  "Email notifications could not be sent.": "تعذر إرسال إشعارات البريد الإلكتروني.",
  "There are no other active project users to notify.": "لا يوجد مستخدمون نشطون آخرون في المشروع لإشعارهم.",
  "notifications sent": "إشعارات أُرسلت",
  "could not be delivered": "تعذر تسليمها",
  "project user(s) notified successfully": "من مستخدمي المشروع تم إشعارهم بنجاح"
});

Object.assign(ku, {
  "No weekly data": "هیچ داتای هەفتانەیەک نییە",
  "Electrical Works": "کارەکانی کارەبا",
  "I&C Works": "کارەکانی ئامێر و کۆنترۆڵ"
});

Object.assign(ar, {
  "No weekly data": "لا توجد بيانات أسبوعية",
  "Electrical Works": "الأعمال الكهربائية",
  "I&C Works": "أعمال الأجهزة والتحكم"
});

const dictionaries: Record<Locale, Record<string, string>> = { en: {}, ku, ar };
const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string } | null>(null);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function mapped(locale: Locale, value: string) {
  return dictionaries[locale][value] ?? value;
}

function translateTree(root: ParentNode, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && !parent.closest("script, style, code, pre, .language-switcher") && !parent.closest("svg")) {
      const current = textNode.nodeValue ?? "";
      const remembered = originalText.get(textNode);
      const candidate = remembered ?? current;
      const trimmed = candidate.trim();
      if (remembered || ku[trimmed] || ar[trimmed]) {
        if (!remembered) originalText.set(textNode, candidate);
        const leading = candidate.match(/^\s*/)?.[0] ?? "";
        const trailing = candidate.match(/\s*$/)?.[0] ?? "";
        const translated = locale === "en" ? trimmed : mapped(locale, trimmed);
        const next = `${leading}${translated}${trailing}`;
        if (current !== next) textNode.nodeValue = next;
      }
    }
    node = walker.nextNode();
  }

  root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((element) => {
    if (element.closest(".language-switcher")) return;
    const originals = originalAttributes.get(element) ?? new Map<string, string>();
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const source = originals.get(attribute) ?? current;
      if (!ku[source] && !ar[source] && !originals.has(attribute)) return;
      originals.set(attribute, source);
      element.setAttribute(attribute, locale === "en" ? source : mapped(locale, source));
    });
    if (originals.size) originalAttributes.set(element, originals);
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("taurus-locale", next);
    document.cookie = `taurus-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);
  const t = useCallback((key: string) => mapped(locale, key), [locale]);

  useEffect(() => {
    const saved = localStorage.getItem("taurus-locale");
    if (saved === "ku" || saved === "ar" || saved === "en") setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ku" ? "ckb" : locale;
    document.documentElement.dir = locale === "en" ? "ltr" : "rtl";
    document.documentElement.dataset.locale = locale;
    let observer: MutationObserver;
    const applyTranslations = () => {
      observer?.disconnect();
      translateTree(document.body, locale);
      observer?.observe(document.body, { childList: true, characterData: true, subtree: true });
    };
    observer = new MutationObserver(applyTranslations);
    applyTranslations();
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLanguage();
  const options: Array<{ value: Locale; label: string; flag: React.ReactNode }> = [
    { value: "en", label: "English", flag: <Image alt="United Kingdom flag" height={18} src="/flags/uk.svg" width={27} /> },
    { value: "ku", label: "Kurdish Sorani", flag: <Image alt="Kurdistan Region flag" height={18} src="/flags/krg.svg" width={27} /> },
    { value: "ar", label: "Arabic", flag: <Image alt="Iraq flag" height={18} src="/flags/iraq.svg" width={27} /> }
  ];
  return (
    <div className={`language-switcher ${compact ? "language-switcher-compact" : ""}`} aria-label="Language">
      {options.map((option) => (
        <button className={locale === option.value ? "selected" : ""} key={option.value} onClick={() => setLocale(option.value)} title={t(option.label)} type="button">
          {option.flag}<span>{compact ? option.value.toUpperCase() : t(option.label)}</span>
        </button>
      ))}
    </div>
  );
}
