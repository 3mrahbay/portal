# Kitap Kulübü görünüm tercihi — onay bekliyor

Portal ve ZEKY Android/iOS ortak web arayüzünde slogan: “Bir kitap, birçok duygu, güzel bir buluşma.”

Ana sayfadaki kart × düğmesiyle gizlenir. Yerinde kalan çay ve kitap simgeli Kitap Kulübü düğmesi kartı yeniden açar. Tercih kullanıcı kimliğine göre bu tarayıcı/uygulamada saklanır; başka cihazlara aktarılmaz. Depolama kullanılamazsa mevcut oturumda çalışır. Erişim yetkileri değişmez; kitap, üyelik, mesaj ve fotoğraf kayıtlarına yazılmaz.

Doğrulama: qa/kitap-kulubu-preference-dom.cjs; ilgili Kitap Kulübü testleri. Android ve iOS aynı www kaynaklarını kullanır. Mağaza paketi hazırlanmadı/gönderilmedi. Portal yayını, merge ve mağaza güncellemeleri kullanıcı onayını bekler.
